# Testing Event Flow for Chat Updates

## Test Steps

1. Open the Electron app
2. Log in with demo/demo credentials
3. Open Developer Console (View > Toggle Developer Tools)
4. Select a conversation (or create one)
5. Run this in the console:

```javascript
// Test 1: Check if the test function is available
console.log('Test function available:', typeof window.testMessageUpdate)

// Test 2: Trigger a test message update
await window.testMessageUpdate()

// Test 3: Check if lamaBridge is receiving events
window.lamaBridge.on('chat:newMessages', (data) => {
  console.log('🎯 TEST: Received chat:newMessages event!', data)
})

// Test 4: Manually trigger from backend
await window.electronAPI.invoke('test:triggerMessageUpdate', {
  conversationId: 'test-conversation'
})
```

## Expected Results

1. Should see "Test function available: function"
2. Should see test trigger result in console
3. Should see "🎯 TEST: Received chat:newMessages event!" when events arrive
4. Check for "[Preload] Forwarding IPC event: chat:newMessages" in console

## Debugging

If events aren't arriving:
- Check Network tab for WebSocket connections
- Check if mainWindow reference is set (backend logs)
- Verify preload script is loading (check for "[Preload] Electron APIs exposed" log)

## Current Issue

The problem is that `chat:newMessages` events from PeerMessageListener are not reaching the React components to trigger re-renders, even though:
- PeerMessageListener detects new messages
- IPC events are being sent
- Preload script is configured to forward them
- LamaBridge is set up to receive them