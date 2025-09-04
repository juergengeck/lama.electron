/**
 * AI Contact Manager for Node.js instance
 * Creates and manages AI contacts within the instance
 */

import LLMObjectManager from './llm-object-manager.js'

class AIContactManager {
  constructor(nodeOneCore) {
    this.nodeOneCore = nodeOneCore
    this.aiContacts = new Map()
    this.llmObjectManager = new LLMObjectManager(nodeOneCore)
  }

  /**
   * Create an AI contact properly within the Node.js instance
   */
  async createAIContact(modelId, displayName) {
    console.log(`[AIContactManager] Creating AI contact for ${displayName} (${modelId})`)
    
    try {
      const leuteModel = this.nodeOneCore.leuteModel
      if (!leuteModel) {
        console.error('[AIContactManager] LeuteModel not available')
        return null
      }

      // Create email for AI identity
      const email = `${modelId.replace(/[^a-zA-Z0-9]/g, '_')}@ai.local`
      
      // Create Person directly through Node.js instance (uses the correct ONE.core instance with registered recipes)
      const personData = {
        $type$: 'Person',
        email: email,
        name: displayName
      }
      
      // Store the Person object directly using the authenticator
      const { storeIdObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      const result = await storeIdObject(personData)
      // storeIdObject returns an object with idHash property
      const personIdHash = typeof result === 'object' && result.idHash ? result.idHash : result
      console.log(`[AIContactManager] Created Person for ${displayName}: ${personIdHash.toString().substring(0, 8)}...`)
      
      // Check if Someone already exists for this Person
      let someone
      try {
        someone = await leuteModel.getSomeone(personIdHash)
        if (someone?.idHash) {
          console.log(`[AIContactManager] Someone already exists for ${displayName}`)
          return someone.idHash
        }
      } catch (error) {
        // Someone doesn't exist, will create it
        console.log(`[AIContactManager] Creating new Someone for ${displayName}`)
      }

      // Create Profile and Someone (following LAMA approach)
      const ProfileModel = (await import('@refinio/one.models/lib/models/Leute/ProfileModel.js')).default
      const profile = await ProfileModel.constructWithNewProfile(
        personIdHash,
        await leuteModel.myMainIdentity(),
        'default'
      )

      // Add display name
      profile.personDescriptions.push({
        $type$: 'PersonName',
        name: displayName
      })

      await profile.saveAndLoad()
      console.log(`[AIContactManager] ✅ Created Profile ${profile.idHash.toString().substring(0, 8)}...`)

      // Create Someone
      const SomeoneModel = (await import('@refinio/one.models/lib/models/Leute/SomeoneModel.js')).default
      someone = await SomeoneModel.constructWithNewSomeone(
        leuteModel,
        `ai-${modelId}`,  // Use model ID for deterministic Someone
        profile
      )
      console.log(`[AIContactManager] ✅ Created Someone ${someone.idHash.toString().substring(0, 8)}...`)

      // Add to contacts
      await leuteModel.addSomeoneElse(someone.idHash)
      console.log(`[AIContactManager] ✅ Added ${displayName} to contacts`)
      
      // Create LLM object to identify this as an AI contact
      await this.llmObjectManager.createLLMObject(modelId, displayName, personIdHash)
      console.log(`[AIContactManager] ✅ Created LLM object for ${displayName}`)
      
      // Grant access for CHUM sync to browser
      await this.grantAccessToAIContact(someone, profile, personIdHash)
      
      // Store the personId in our cache
      this.aiContacts.set(modelId, personIdHash)
      
      return someone.idHash
      
    } catch (error) {
      console.error(`[AIContactManager] Failed to create AI contact for ${displayName}:`, error)
      return null
    }
  }

  /**
   * Set up AI contacts for all available models
   */
  async setupAIContacts(models) {
    console.log(`[AIContactManager] Setting up ${models.length} AI contacts...`)
    
    const createdContacts = []
    
    for (const model of models) {
      try {
        const personId = await this.createAIContact(model.id, model.name)
        if (personId) {
          createdContacts.push({
            modelId: model.id,
            personId: personId,
            name: model.name
          })
        }
      } catch (error) {
        console.error(`[AIContactManager] Failed to create contact for ${model.name}:`, error)
      }
    }
    
    console.log(`[AIContactManager] ✅ Created ${createdContacts.length} AI contacts`)
    return createdContacts
  }

  /**
   * Get all AI contacts
   */
  getAllContacts() {
    return Array.from(this.aiContacts.entries()).map(([modelId, personId]) => ({
      modelId,
      personId
    }))
  }

  /**
   * Get person ID for a model
   */
  getPersonIdForModel(modelId) {
    return this.aiContacts.get(modelId)
  }
  
  /**
   * Grant access to AI contact for CHUM sync
   */
  async grantAccessToAIContact(someone, profile, personIdHash) {
    try {
      const { createAccess } = await import('@refinio/one.core/lib/access.js')
      const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
      
      // Get groups for access
      const federationGroup = this.nodeOneCore.federationGroup
      const groups = federationGroup ? [federationGroup.groupIdHash] : []
      
      // Grant access to the Someone object
      await createAccess([{
        id: someone.idHash,
        person: [],
        group: groups,
        mode: SET_ACCESS_MODE.ADD
      }])
      console.log(`[AIContactManager] Granted federation group access to Someone: ${someone.idHash.substring(0, 8)}...`)
      
      // Grant access to the Profile
      if (profile?.idHash) {
        await createAccess([{
          id: profile.idHash,
          person: [],
          group: groups,
          mode: SET_ACCESS_MODE.ADD
        }])
        console.log(`[AIContactManager] Granted federation group access to Profile: ${profile.idHash.substring(0, 8)}...`)
      }
      
      // Grant access to the Person object
      await createAccess([{
        id: personIdHash,
        person: [],
        group: groups,
        mode: SET_ACCESS_MODE.ADD
      }])
      console.log(`[AIContactManager] Granted federation group access to Person: ${personIdHash.toString().substring(0, 8)}...`)
      
    } catch (error) {
      console.error('[AIContactManager] Failed to grant access for AI contact:', error)
    }
  }
}

export default AIContactManager