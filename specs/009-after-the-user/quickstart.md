# Quickstart: Default LLM Topic Initialization

## Prerequisites
- LAMA Electron running
- At least one LLM model available (Ollama or API)
- User logged in

## Test Scenario 1: First-Time Model Selection

1. **Open LAMA Electron**
   ```bash
   npm run electron
   ```

2. **Navigate to Model Selection**
   - Click "Settings" or open Model Onboarding
   - View available models list

3. **Select Default Model**
   - Choose a model (e.g., "llama3.2")
   - Click "Set as Default"

4. **Verify Topics Created**
   - Check conversation list
   - Should see:
     - "Hi" topic (ID: hi)
     - "LAMA" topic (ID: lama)

5. **Open Hi Topic**
   - Click on "Hi" conversation
   - Verify static welcome message appears:
   ```
   Hi! I'm LAMA, your local AI assistant.

   I run entirely on your device - no cloud, just private, fast AI help.

   What can I do for you today?
   ```
   - Verify NO additional LLM-generated message

6. **Open LAMA Topic**
   - Click on "LAMA" conversation
   - Verify LLM-generated welcome message appears
   - Message should be unique and contextual

## Test Scenario 2: Changing Default Model

1. **With Existing Topics**
   - Ensure "Hi" and "LAMA" exist from Scenario 1

2. **Select Different Model**
   - Go to Settings
   - Choose different model (e.g., "claude-3-opus")
   - Set as default

3. **Verify Participant Switch**
   - Should NOT create new topics (already exist)
   - Topics remain as:
     - "Hi" (ID: hi)
     - "LAMA" (ID: lama)
   - AI participant updated to new model
   - Previous model removed from participants
   - Conversation history preserved

## Test Scenario 3: Re-selecting Same Model

1. **Select Current Default Again**
   - Go to Settings
   - Select same model already set as default

2. **Verify No Duplicates**
   - No new topics created
   - Existing conversations preserved
   - No duplicate welcome messages

## Validation Checklist

### ✅ Topic Creation
- [ ] Hi topic uses hardcoded ID "hi"
- [ ] LAMA topic uses hardcoded ID "lama"
- [ ] Topics appear in conversation list immediately

### ✅ Welcome Messages
- [ ] Hi topic shows static message only
- [ ] LAMA topic generates LLM welcome
- [ ] No duplicate welcomes on re-selection

### ✅ Error Handling
- [ ] Invalid model ID shows error
- [ ] Network issues handled gracefully
- [ ] Settings persist across restarts

## Console Verification

Check browser console for:
```javascript
// Successful topic creation
console.log('Creating default AI topics for model:', modelId);
console.log('Topics created:', { hi: hiTopicId, lama: lamaTopicId });

// Duplicate prevention
console.log('Topics already exist for model:', modelId);
```

## Expected IPC Flow

1. Browser: `electronAPI.invoke('ai:setDefaultModel', { modelId: 'llama3.2' })`
2. Node.js: Creates topics with correct IDs
3. Response: `{ success: true, topics: { hi: 'hi', lama: 'lama' } }`

## Troubleshooting

### Topics Not Appearing
- Check console for errors
- Verify model ID is valid
- Ensure ONE.core is initialized

### Wrong Topic IDs
- Verify fix in `/main/ipc/handlers/ai.js`
- Check topic ID generation logic

### Welcome Message Issues
- Check `suppressWelcome` flag in handleNewTopic()
- Verify static message content

## Success Criteria

✅ All test scenarios pass
✅ No console errors
✅ Topics persist after restart
✅ Correct IDs for all topics
✅ Proper welcome message behavior