# LAMA Electron Desktop App

A desktop application for LAMA (Local AI Messaging App) built with Electron, React, and ONE.CORE with Internet of Me (IoM) support.

## Current Status

✅ **Working Features:**
- Electron app with custom macOS title bar
- Full ONE.CORE integration with IoM (Internet of Me)
- MultiUser authentication system
- AI chat interface with multiple LLM providers
- Conversations management with persistence
- Settings with AI provider configuration
- **Data Dashboard with real-time IOM replication monitoring**
- **CHUM protocol sync status and error tracking**
- **Live storage metrics from actual system resources**
- Development hot-reload with Vite
- IPC communication for UDP and native features
- App data reset with automatic restart

🚧 **In Progress:**
- Journal tab (unified with chat messages)
- Contacts management UI
- P2P networking via IoM connections
- Multi-device synchronization
- BLE/UDP discovery for mobile instances

## Architecture

```
lama-electron-shadcn.js     # Main Electron process
├── Window Management (macOS hiddenInset)
├── IPC Handlers (UDP, App Data, System)
├── Custom Title Bar Injection
└── Dev/Production modes

main/                       # Node.js Backend
├── app.js                 # Main application controller
├── config/
│   └── iom-config.js      # IOM monitoring configuration
├── hybrid/
│   ├── real-node-instance.js  # ONE.CORE + IoM integration
│   ├── node-provisioning.js   # Browser-Node provisioning
│   └── chum-monitor.js    # CHUM sync monitoring
└── ipc/
    ├── controller.js      # IPC communication handler
    └── handlers/
        └── iom.js         # IOM replication state handlers

electron-ui/               # React Frontend
├── src/
│   ├── App.tsx           # Main app with navigation
│   ├── components/       # UI components
│   │   ├── ChatLayout.tsx    # Multi-conversation chat
│   │   ├── ChatView.tsx      # Individual chat interface
│   │   ├── DataDashboard.tsx # IOM replication monitoring
│   │   ├── SettingsView.tsx  # AI providers & app settings
│   │   └── ModelOnboarding.tsx # LLM setup wizard
│   ├── models/           # Data models
│   │   ├── AppModel.ts       # Root orchestrator
│   │   └── ai/               # AI integration
│   │       ├── LLMManager.ts # LLM provider management
│   │       └── AIAssistantModel.ts
│   └── services/         # Core services
│       ├── real-browser-instance.ts  # Browser ONE.CORE
│       └── init-flow.ts             # Platform initialization
```

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
# Install dependencies
npm install

# Start development
npm run dev              # Start Vite dev server (in lama/electron-ui)
npm run electron         # Launch Electron app
```

### Running the App
1. Start the Vite dev server:
   ```bash
   cd lama/electron-ui
   npm run dev
   ```

2. In another terminal, launch Electron:
   ```bash
   NODE_ENV=development npx electron lama-electron-shadcn.js
   ```

### Building for Production
```bash
cd lama/electron-ui
npm run build
NODE_ENV=production npx electron lama-electron-shadcn.js
```

## UI Components

### Navigation Tabs
- **Chats** - Message conversations with P2P contacts
- **Journal** - Personal notes and thoughts (unified with chat)
- **Contacts** - Manage P2P connections
- **Settings** - App configuration and preferences

### Features to Implement
1. **Journal/Chat Unification**
   - Share message component between Journal and Chat
   - Journal entries are self-messages
   - Same storage and sync mechanism

2. **Contacts Management**
   - Add/remove contacts
   - Display connection status
   - Pairing via QR codes or links

3. **Settings**
   - Profile management
   - Network configuration
   - AI model selection
   - Privacy settings

## Key Features

### Internet of Me (IoM)
The app establishes a full Internet of Me using ONE.CORE and one.models:
- **IoMManager** - Manages device synchronization across your personal network
- **LeuteModel** - Handles identity management and trust certificates
- **ChannelManager** - Manages data channels for synchronization
- **MultiUser Authentication** - Secure multi-user support with encrypted storage

### AI Integration
- Multiple LLM providers (Claude, OpenAI, Ollama, HuggingFace)
- Streaming responses with markdown support
- Conversation persistence and management
- Model configuration and API key management

### Native Features
- UDP sockets for P2P communication
- IndexedDB for browser storage
- File system access for Node.js storage
- Custom macOS title bar with traffic light controls
- App data reset with automatic restart

## Next Steps

1. **Immediate Tasks**
   - [ ] Implement Journal tab with message display
   - [ ] Add Contacts list view
   - [ ] Create Settings UI
   - [ ] Unify message components

2. **Integration Tasks**
   - [ ] Replace mock lama-bridge with real implementation
   - [ ] Connect to ONE platform models
   - [ ] Enable P2P networking
   - [ ] Add local AI processing

3. **Polish**
   - [ ] Dark/light theme toggle
   - [ ] System tray support
   - [ ] Auto-updates
   - [ ] Cross-platform testing

## Known Issues

- Preload script must use .cjs extension due to ES modules
- DevTools autofill warnings (can be ignored)
- Window focus state not always accurate

## Contributing

This is part of the LAMA ecosystem. See main LAMA repository for contribution guidelines.