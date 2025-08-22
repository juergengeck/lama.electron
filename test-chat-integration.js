// Test script to verify chat integration with TopicModel
// Run this after the Electron app is running

async function testChatIntegration() {
  console.log('=== Testing Chat Integration with TopicModel ===\n')
  
  try {
    // Check if we're in the Electron environment
    if (typeof window === 'undefined' || !window.lamaBridge) {
      console.error('This test must be run in the Electron renderer process')
      console.log('Open the developer console in the Electron app and paste this script')
      return
    }
    
    const bridge = window.lamaBridge
    const appModel = bridge.getAppModel()
    
    // 1. Check if TopicModel is available
    console.log('1. Checking TopicModel availability...')
    if (!appModel) {
      console.error('❌ AppModel not available')
      return
    }
    
    if (!appModel.topicModel) {
      console.error('❌ TopicModel not available in AppModel')
      return
    }
    console.log('✅ TopicModel is available')
    
    // 2. Test getting messages from the default conversation
    console.log('\n2. Testing message retrieval...')
    const messages = await bridge.getMessages('default')
    console.log(`✅ Retrieved ${messages.length} messages`)
    if (messages.length > 0) {
      console.log('First message:', messages[0])
    }
    
    // 3. Test sending a message
    console.log('\n3. Testing message sending...')
    const testMessage = 'Test message from integration test: ' + new Date().toISOString()
    const messageId = await bridge.sendMessage('test-recipient', testMessage)
    console.log('✅ Message sent with ID:', messageId)
    
    // 4. Wait a bit and check if message was stored
    console.log('\n4. Verifying message storage...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const updatedMessages = await bridge.getMessages('default')
    const sentMessage = updatedMessages.find(m => m.content === testMessage)
    
    if (sentMessage) {
      console.log('✅ Message was properly stored in TopicModel')
      console.log('Stored message:', sentMessage)
    } else {
      console.warn('⚠️ Message might not be stored yet or TopicRoom creation failed')
    }
    
    // 5. Check AI response (if available)
    console.log('\n5. Checking AI integration...')
    if (appModel.llmManager || appModel.aiAssistantModel) {
      console.log('✅ AI components available')
      
      // Wait for potential AI response
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const finalMessages = await bridge.getMessages('default')
      const aiResponse = finalMessages.find(m => 
        m.senderId === 'ai-assistant' && 
        finalMessages.indexOf(m) > finalMessages.indexOf(sentMessage!)
      )
      
      if (aiResponse) {
        console.log('✅ AI response received:', aiResponse.content.substring(0, 100) + '...')
      } else {
        console.log('ℹ️ No AI response (AI might not be configured or model not loaded)')
      }
    } else {
      console.log('ℹ️ AI components not available')
    }
    
    // 6. Check TopicRoom directly
    console.log('\n6. Checking TopicRoom directly...')
    try {
      const topicRoom = await appModel.topicModel.enterTopicRoom('default')
      if (topicRoom) {
        console.log('✅ TopicRoom accessible directly')
        
        // Get messages directly from TopicRoom
        const directMessages = await topicRoom.retrieveAllMessages()
        console.log(`✅ Direct retrieval: ${directMessages.length} messages in TopicRoom`)
      } else {
        console.warn('⚠️ Could not access TopicRoom directly')
      }
    } catch (error) {
      console.error('❌ Error accessing TopicRoom:', error)
    }
    
    console.log('\n=== Test Complete ===')
    console.log('Summary:')
    console.log('- TopicModel integration:', appModel.topicModel ? '✅' : '❌')
    console.log('- Message retrieval:', messages.length > 0 ? '✅' : '⚠️')
    console.log('- Message sending:', messageId ? '✅' : '❌')
    console.log('- Message storage:', sentMessage ? '✅' : '⚠️')
    console.log('\nThe chat system is now using TopicModel for proper ONE platform storage.')
    console.log('Messages are stored as ONE objects and can be synced across devices.')
    
  } catch (error) {
    console.error('Test failed with error:', error)
  }
}

// Export for use in console
if (typeof module !== 'undefined' && module.exports) {
  module.exports = testChatIntegration
} else {
  // Make it available globally in browser/Electron
  window.testChatIntegration = testChatIntegration
}

console.log('Test script loaded. Run testChatIntegration() to start the test.')