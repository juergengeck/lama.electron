# LAMA CLI Integration Test

## Architecture

The refinio.cli now includes a `lama` command that provides full control over the LAMA Electron application:

```
refinio lama <subcommand>
```

## Available Commands

### Application Control
- `refinio lama start` - Start LAMA Electron (with optional --clear to clear storage)
- `refinio lama stop` - Stop LAMA Electron 
- `refinio lama status` - Check application status
- `refinio lama login <username>` - Login to LAMA

### Chat Operations
- `refinio lama chat list` - List all conversations
- `refinio lama chat create <name>` - Create new conversation
- `refinio lama chat send <channel> <message>` - Send message

### Contact Management  
- `refinio lama contact list` - List all contacts
- `refinio lama contact add <email>` - Add new contact

### AI Assistant
- `refinio lama ai models` - List available AI models
- `refinio lama ai ask <prompt>` - Ask AI assistant

## Usage Examples

```bash
# Start LAMA with clean storage
refinio lama start --clear

# Login
refinio lama login demo

# Check status
refinio lama status

# List conversations
refinio lama chat list

# Create a conversation
refinio lama chat create "My Chat"

# Send a message
refinio lama chat send "channel-id" "Hello world"

# Add a contact
refinio lama contact add alice@example.com --name "Alice"

# Ask AI
refinio lama ai ask "What is the weather today?"

# Stop the app
refinio lama stop
```

## Integration Points

1. **API Server**: The Electron app runs a QUIC API server on port 9876
2. **Authentication**: Uses Person keys for secure API access
3. **Commands**: All commands use the embedded API server
4. **Real-time**: Commands interact directly with the running LAMA instance

This provides a complete CLI interface to LAMA without needing the UI!

## Setup

To use these commands, you need to:

1. Build and link the refinio.cli package:
```bash
cd packages/refinio.cli
npm install
npm run build
npm link
```

2. Now you can use `refinio lama` commands globally:
```bash
refinio lama start
refinio lama status
```