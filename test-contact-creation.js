#!/usr/bin/env node

/**
 * Test script to verify that remote contacts are created properly
 */

import NodeOneCore from './main/core/node-one-core.js'

async function testContactCreation() {
  console.log('Testing contact creation during connection establishment...')

  try {
    const nodeCore = NodeOneCore.getInstance()

    // Initialize the node
    console.log('Initializing node instance...')
    await nodeCore.initialize('test-user', 'test-password')

    // Verify leuteModel is initialized
    if (!nodeCore.leuteModel) {
      console.error('❌ LeuteModel not initialized')
      process.exit(1)
    }

    console.log('✅ Node initialized successfully')

    // Get initial contacts count
    const initialContacts = await nodeCore.leuteModel.getSomeoneElseList()
    console.log(`Initial contacts count: ${initialContacts.length}`)

    // Simulate a pairing success (this is what happens when a connection is established)
    const testRemotePersonId = 'test-remote-person-' + Date.now()

    console.log('Simulating connection establishment...')

    // This is the code that runs in the pairing success callback
    const { default: ProfileModel } = await import('@refinio/one.models/lib/models/Leute/ProfileModel.js')
    const { default: SomeoneModel } = await import('@refinio/one.models/lib/models/Leute/SomeoneModel.js')
    const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')

    // Create a minimal profile for the remote contact
    const myId = await nodeCore.leuteModel.myMainIdentity()
    const profileModel = await ProfileModel.constructWithNewProfile(
      testRemotePersonId,
      myId,
      'default'
    )
    await profileModel.saveAndLoad()
    const profileHash = profileModel.idHash

    // Create Someone object properly with profile
    const newSomeone = {
      $type$: 'Someone',
      someoneId: testRemotePersonId,
      mainProfile: profileHash,
      identities: new Map([[testRemotePersonId, new Set([profileHash])]])
    }

    const someoneResult = await storeVersionedObject(newSomeone)
    const someoneIdHash = someoneResult.idHash

    // Add to LeuteModel
    await nodeCore.leuteModel.addSomeoneElse(someoneIdHash)
    console.log(`✅ Added new contact to LeuteModel: ${someoneIdHash.substring(0, 8)}...`)

    // Verify the contact was added
    const updatedContacts = await nodeCore.leuteModel.getSomeoneElseList()
    console.log(`Updated contacts count: ${updatedContacts.length}`)

    // Find the newly added contact
    const newContact = updatedContacts.find(c => c.someoneId === testRemotePersonId)

    if (newContact) {
      console.log('✅ Contact created successfully!')
      console.log('Contact details:', {
        someoneId: newContact.someoneId,
        hasProfile: !!newContact.mainProfile
      })

      // Verify it's not showing self as contact
      const myIdentity = await nodeCore.leuteModel.myMainIdentity()
      if (newContact.someoneId === myIdentity) {
        console.error('❌ ERROR: Contact shows as self!')
        process.exit(1)
      } else {
        console.log('✅ Contact is correctly showing remote person, not self')
      }
    } else {
      console.error('❌ Contact not found after adding')
      process.exit(1)
    }

    console.log('\n✅ All tests passed!')
    process.exit(0)

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testContactCreation()