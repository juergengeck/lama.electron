/**
 * Proper contact creation helper using ONE.models APIs
 * Based on lama's createProfileAndSomeoneForPerson implementation
 */
import ProfileModel from '@refinio/one.models/lib/models/Leute/ProfileModel.js';
import SomeoneModel from '@refinio/one.models/lib/models/Leute/SomeoneModel.js';
import { ensureIdHash } from '@refinio/one.core/lib/util/type-checks.js';
import { getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js';
/**
 * Creates a Profile and Someone object for an existing Person, following the correct ONE object relationship sequence.
 * This is based on lama's createProfileAndSomeoneForPerson function.
 *
 * @param {string} personId - The Person ID to create objects for
 * @param {Object} leuteModel - The initialized LeuteModel instance
 * @param {Object} profileOptions - Options for the profile (displayName, descriptors, etc.)
 * @returns {Promise<Object>} The newly created Someone object
 */
export async function createProfileAndSomeoneForPerson(personId, leuteModel, profileOptions = {}) {
    console.log(`[ContactCreationProper] 📝 Creating new contact for Person ${personId?.substring(0, 8)}...`);
    try {
        // 1. Create Profile using proper ProfileModel API
        console.log('[ContactCreationProper]   ├─ Creating Profile object...');
        const profile = await ProfileModel.constructWithNewProfile(ensureIdHash(personId), await leuteModel.myMainIdentity(), 'default', [], // communicationEndpoints - empty array
        [] // personDescriptions - will add after creation
        );
        // Add display name if provided
        if (profileOptions.displayName) {
            console.log(`[ContactCreationProper] Adding display name: ${profileOptions.displayName}`);
            profile.personDescriptions.push({
                $type$: 'PersonName',
                name: profileOptions.displayName
            });
        }
        // Add any other descriptors if provided
        if (profileOptions.descriptors && Array.isArray(profileOptions.descriptors)) {
            profileOptions.descriptors.forEach((descriptor) => {
                profile.personDescriptions.push(descriptor);
            });
        }
        await profile.saveAndLoad();
        console.log(`[ContactCreationProper]   ├─ Profile saved: ${profile.idHash.toString().substring(0, 8)}`);
        // 2. Create Someone using proper SomeoneModel API
        console.log('[ContactCreationProper]   ├─ Creating Someone object...');
        const someoneId = `someone-for-${personId}`;
        const someone = await SomeoneModel.constructWithNewSomeone(someoneId, profile.idHash);
        console.log(`[ContactCreationProper]   ├─ Someone created: ${someone.idHash.toString().substring(0, 8)}`);
        // 3. Add to contacts (idempotent)
        console.log('[ContactCreationProper]   ├─ Adding to contacts list...');
        await leuteModel.addSomeoneElse(someone.idHash);
        console.log('[ContactCreationProper]   └─ ✅ Contact creation complete!');
        return someone;
    }
    catch (error) {
        console.error('[ContactCreationProper] Error creating Profile/Someone:', error);
        throw error;
    }
}
/**
 * Ensures a contact (Person, Profile, Someone) exists for a given Person ID.
 * Retrieves the existing Someone or creates the full persona if needed.
 *
 * @param {string} personId - The ID hash of the Person
 * @param {Object} leuteModel - The initialized LeuteModel instance
 * @param {Object} profileOptions - Options for creating the profile if needed
 * @returns {Promise<Object>} The Someone object (existing or created)
 */
export async function ensureContactExists(personId, leuteModel, profileOptions = {}) {
    console.log(`[ContactCreationProper] Ensuring contact for Person ${personId?.substring(0, 8)}...`);
    // First check all existing contacts to see if any already use this Person ID
    try {
        const others = await leuteModel.others();
        if (others && Array.isArray(others) && others.length > 0) {
            // Find any existing Someone with the same personId (mainIdentity)
            for (const contact of others) {
                if (!contact)
                    continue;
                let contactPersonId;
                try {
                    // Get the Person ID for this contact using mainIdentity if available
                    if (typeof contact.mainIdentity === 'function') {
                        contactPersonId = await contact.mainIdentity();
                    }
                    else if ('personId' in contact) {
                        contactPersonId = contact.personId;
                    }
                    // If this contact has the same Person ID, return it
                    if (contactPersonId && contactPersonId.toString() === personId.toString()) {
                        console.log(`[ContactCreationProper] Found existing Someone ${contact.idHash} with matching Person ID in contacts`);
                        return contact;
                    }
                }
                catch (identityError) {
                    console.warn(`[ContactCreationProper] Error getting identity for contact:`, identityError);
                }
            }
        }
    }
    catch (othersError) {
        console.warn(`[ContactCreationProper] Error checking existing contacts:`, othersError);
    }
    // If no matching contact was found in the list, we need to create one
    // Note: leuteModel.getSomeone looks for Someone objects that reference the Person ID,
    // not the Person ID itself, so we can't use it to check if we need to create a Someone
    console.log(`[ContactCreationProper] No existing Someone found for Person ${personId}. Creating Profile and Someone...`);
    try {
        const someone = await createProfileAndSomeoneForPerson(personId, leuteModel, profileOptions);
        console.log(`[ContactCreationProper] ✅ Successfully created and added contact for Person ${personId}`);
        return someone;
    }
    catch (creationError) {
        console.error(`[ContactCreationProper] Failed to create Profile/Someone for Person ${personId}:`, creationError);
        throw creationError;
    }
}
/**
 * Get display name from a Person object
 * @param {string} personId - The Person ID
 * @returns {Promise<string>} Display name or default
 */
async function getPersonDisplayName(personId) {
    try {
        const personResult = await getObjectByIdHash(ensureIdHash(personId));
        const person = personResult?.obj;
        if (person) {
            // Try to get name or email
            if (person.name)
                return person.name;
            if (person.email) {
                // Extract name from email
                const emailName = person.email.split('@')[0];
                return emailName.replace(/[._-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
            }
        }
    }
    catch (error) {
        console.log(`[ContactCreationProper] Could not get Person object for display name:`, error.message);
    }
    return 'Remote Contact';
}
/**
 * Handle new contact when a connection is established
 * This is called when we receive a new connection from a remote instance
 *
 * @param {string} remotePersonId - The remote person's ID
 * @param {Object} leuteModel - The LeuteModel instance
 * @returns {Promise<Object>} The Someone object
 */
export async function handleNewConnection(remotePersonId, leuteModel) {
    console.log('[ContactCreationProper] 🤝 Handling new connection from:', remotePersonId?.substring(0, 8));
    console.log('[ContactCreationProper] Step 1/3: Getting display name for contact...');
    try {
        // Get a display name for the contact
        const displayName = await getPersonDisplayName(remotePersonId);
        console.log('[ContactCreationProper] Step 2/3: Creating/retrieving contact for:', displayName);
        // Ensure the contact exists with proper Profile and Someone
        const someone = await ensureContactExists(remotePersonId, leuteModel, { displayName });
        console.log('[ContactCreationProper] Step 3/3: Contact setup complete!');
        console.log('[ContactCreationProper] ✅ Contact ready for:', displayName);
        return someone;
    }
    catch (error) {
        console.error('[ContactCreationProper] Error handling new connection:', error);
        throw error;
    }
}
/**
 * Update Someone when we receive Profile data via CHUM
 * @param {string} personId - The person ID
 * @param {Object} profileData - The received profile data
 * @param {Object} leuteModel - The LeuteModel instance
 */
export async function handleReceivedProfile(personId, profileData, leuteModel) {
    console.log('[ContactCreationProper] 📦 Received Profile data for:', personId?.substring(0, 8));
    try {
        // First ensure the contact exists (creates if needed)
        const someone = await ensureContactExists(personId, leuteModel);
        if (someone) {
            // Update the profile with new data
            const profile = await someone.mainProfile();
            // Update profile descriptions if provided
            if (profileData.personDescriptions) {
                profile.personDescriptions = profileData.personDescriptions;
                await profile.saveAndLoad();
                console.log('[ContactCreationProper] ✅ Updated Profile with received data');
            }
        }
        else {
            console.log('[ContactCreationProper] Could not ensure contact exists for:', personId?.substring(0, 8));
        }
    }
    catch (error) {
        console.error('[ContactCreationProper] Error handling received Profile:', error);
    }
}
