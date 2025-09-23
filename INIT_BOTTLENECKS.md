# Initialization Bottlenecks & Redundancies

## Critical Delays

### 1. LLM Cold Start (12+ seconds)
- **Issue**: First AI response takes 12341ms total (9959ms to first chunk)
- **Cause**: Ollama cold start, no connection pre-warming
- **Fix**: Pre-warm Ollama connection during app startup, not after user login

### 2. Vite Dev Server (127ms)
- **Issue**: Starts fresh each time instead of reusing existing server
- **Fix**: Check if server is already running before starting new one

## Redundant Operations

### 1. Excessive OBJECT RECEIVED Logging
- **Count**: 30+ empty object logs during init
- **Impact**: Clutters logs, makes debugging harder
- **Fix**: Remove or condense this logging

### 2. Multiple getContacts Calls
- **Count**: 6 identical calls during initialization
- **Location**: OneCoreHandler
- **Fix**: Cache result or debounce calls

### 3. Duplicate getConversations
- **Count**: Multiple calls before and after channel creation
- **Fix**: Single call after channels are ready

### 4. Redundant secureRetrieve Attempts
- **Issue**: Called twice before ONE.core is initialized, both fail
- **Location**: onecore:secureRetrieve for 'lama-onboarding-completed'
- **Fix**: Check initialization state before attempting

### 5. MCP Tool Registration
- **Issue**: Registers 14 tools individually with separate log for each
- **Fix**: Batch registration with single log

## Conflicting Operations

### 1. Topic Creation Race Condition
- **Issue**: "Topic does not exist yet" error followed by "Topic creation already in progress"
- **Fix**: Proper locking/queueing for topic creation

### 2. Channel Access Before Creation
- **Issue**: Trying to retrieve messages before topic/channel exists
- **Fix**: Ensure channels exist before allowing message operations

## Performance Impact

- **Total init time**: ~15-20 seconds from start to usable
- **Wasted operations**: ~50% of init operations are redundant
- **Log noise**: 80% of logs are uninformative

## Recommended Fixes Priority

1. **HIGH**: Pre-warm LLM connection (save 10+ seconds)
2. **HIGH**: Cache/debounce getContacts calls
3. **MEDIUM**: Remove excessive OBJECT RECEIVED logging
4. **MEDIUM**: Fix topic creation race condition
5. **LOW**: Batch MCP tool registration