/**
 * Pairing Trust Handler
 *
 * Handles trust establishment and profile sharing after successful pairing.
 * Based on one.leute's LeuteAccessRightsManager.trustPairingKeys implementation.
 */
import { getAllEntries } from '@refinio/one.core/lib/reverse-map-query.js';
import { getObject } from '@refinio/one.core/lib/storage-unversioned-objects.js';
import ProfileModel from '@refinio/one.models/lib/models/Leute/ProfileModel.js';
import { createAccess } from '@refinio/one.core/lib/access.js';
import { SET_ACCESS_MODE } from '@refinio/one.core/lib/storage-base-common.js';
import { wait } from '@refinio/one.core/lib/util/promise.js';
/**
 * Trust the keys of a newly paired remote peer.
 * This is critical for enabling secure communication.
 *
 * @param {Object} trust - The TrustedKeysManager instance
 * @param {boolean} initiatedLocally - Whether pairing was initiated by us
 * @param {string} localPersonId - Our person ID
 * @param {string} localInstanceId - Our instance ID
 * @param {string} remotePersonId - Remote person ID
 * @param {string} remoteInstanceId - Remote instance ID
 * @param {string} token - Pairing token
 */
export async function trustPairingKeys(trust, initiatedLocally, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, token) {
    console.log('[PairingTrust] 🔑 Starting key trust establishment for:', remotePersonId?.substring(0, 8));
    // Keys are transported after connection establishment via CHUM
    // We need to wait for them to arrive, with retries
    const maxRetries = 10;
    const retryDelay = 1000; // 1 second
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[PairingTrust] Attempt ${attempt}/${maxRetries} to find keys...`);
            // Query for Keys objects owned by the remote person
            const keys = await getAllEntries(remotePersonId, 'Keys');
            if (keys.length > 0) {
                console.log(`[PairingTrust] Found ${keys.length} key object(s) for remote peer`);
                // Get the first key object
                const key = await getObject(keys[0]);
                console.log('[PairingTrust] Retrieved key object:', {
                    owner: key.owner?.substring(0, 8),
                    hasPublicKey: !!key.publicKey,
                    hasPublicSignKey: !!key.publicSignKey
                });
                // Create SignKey descriptor for the profile
                const signKey = {
                    $type$: 'SignKey',
                    key: key.publicSignKey
                };
                // Create a Profile with the sign key
                // This profile represents our view/trust of the remote person
                console.log('[PairingTrust] Creating profile with trusted sign key...');
                const profile = await ProfileModel.constructWithNewProfile(remotePersonId, localPersonId, 'trusted-peer', // Profile type
                [], // Communication endpoints (can be added later)
                [signKey] // Person descriptions (the sign key)
                );
                if (!profile.loadedVersion) {
                    throw new Error('Profile model has no hash for profile with sign key');
                }
                console.log('[PairingTrust] Profile created:', profile.loadedVersion?.substring(0, 8));
                // Issue a trust certificate for this profile
                console.log('[PairingTrust] Issuing TrustKeysCertificate...');
                await trust.certify('TrustKeysCertificate', { profile: profile.loadedVersion });
                // Refresh trust caches to apply the new certificate
                await trust.refreshCaches();
                console.log('[PairingTrust] ✅ Key trust established successfully for:', remotePersonId?.substring(0, 8));
                return { success: true, profileHash: profile.loadedVersion };
            }
            // Keys not found yet, wait and retry
            if (attempt < maxRetries) {
                console.log('[PairingTrust] Keys not yet available, waiting...');
                await wait(retryDelay);
            }
        }
        catch (error) {
            console.error(`[PairingTrust] Error in attempt ${attempt}:`, error.message);
            if (attempt < maxRetries) {
                await wait(retryDelay);
            }
            else {
                // Final attempt failed
                console.error('[PairingTrust] ❌ Failed to establish key trust after all retries');
                throw error;
            }
        }
    }
    // If we get here, we couldn't find keys after all retries
    console.warn('[PairingTrust] ⚠️ Could not find keys for remote peer after', maxRetries, 'attempts');
    return { success: false, reason: 'Keys not available' };
}
/**
 * Share our main profile with the newly paired peer.
 * This allows them to see our information and establish trust.
 *
 * @param {Object} leuteModel - The LeuteModel instance
 * @param {string} remotePersonId - The remote person to share with
 */
export async function shareMainProfileWithPeer(leuteModel, remotePersonId) {
    console.log('[PairingTrust] 📤 Sharing our main profile with peer:', remotePersonId?.substring(0, 8));
    try {
        // Get our main identity and profile
        const me = await leuteModel.me();
        const mainProfile = me.mainProfileLazyLoad();
        if (!mainProfile || !mainProfile.idHash) {
            console.warn('[PairingTrust] No main profile to share');
            return { success: false, reason: 'No main profile' };
        }
        console.log('[PairingTrust] Our main profile:', mainProfile.idHash?.substring(0, 8));
        // Grant access to our profile for the remote person
        const setAccessParam = {
            id: mainProfile.idHash,
            person: [remotePersonId], // Grant access to this specific person
            group: [], // No group access needed for P2P
            mode: SET_ACCESS_MODE.ADD
        };
        await createAccess([setAccessParam]);
        console.log('[PairingTrust] ✅ Profile shared successfully');
        return { success: true, profileHash: mainProfile.idHash };
    }
    catch (error) {
        console.error('[PairingTrust] Error sharing profile:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Complete trust establishment after pairing.
 * This combines key trust and profile sharing.
 *
 * @param {Object} params - Parameters object
 * @param {Object} params.trust - TrustedKeysManager instance
 * @param {Object} params.leuteModel - LeuteModel instance
 * @param {boolean} params.initiatedLocally - Whether we initiated pairing
 * @param {string} params.localPersonId - Our person ID
 * @param {string} params.localInstanceId - Our instance ID
 * @param {string} params.remotePersonId - Remote person ID
 * @param {string} params.remoteInstanceId - Remote instance ID
 * @param {string} params.token - Pairing token
 */
export async function completePairingTrust(params) {
    const { trust, leuteModel, initiatedLocally, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, token } = params;
    console.log('[PairingTrust] 🤝 Completing trust establishment for pairing');
    console.log('[PairingTrust] Details:', {
        initiatedLocally,
        localPerson: localPersonId?.substring(0, 8),
        remotePerson: remotePersonId?.substring(0, 8)
    });
    try {
        // Step 1: Trust the remote peer's keys
        const trustResult = await trustPairingKeys(trust, initiatedLocally, localPersonId, localInstanceId, remotePersonId, remoteInstanceId, token);
        if (!trustResult.success) {
            console.warn('[PairingTrust] Could not establish key trust:', trustResult.reason);
            // Continue anyway - profile sharing can still work
        }
        // Step 2: Share our profile with the remote peer
        const shareResult = await shareMainProfileWithPeer(leuteModel, remotePersonId);
        if (!shareResult.success) {
            console.warn('[PairingTrust] Could not share profile:', shareResult.reason);
        }
        console.log('[PairingTrust] ✅ Trust establishment completed');
        return {
            success: true,
            keyTrust: trustResult,
            profileShare: shareResult
        };
    }
    catch (error) {
        console.error('[PairingTrust] ❌ Error completing trust establishment:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
