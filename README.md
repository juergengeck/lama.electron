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
- **HTML Export with microdata for conversations**
- **AI-powered topic analysis with keyword extraction**
- **Combined LLM response + analysis in single call**
- **Deterministic topic ID generation**
- Development hot-reload with Vite
- IPC communication for UDP and native features
- App data reset with automatic restart
- MCP (Model Context Protocol) tool integration

🚧 **In Progress:**
- Journal tab (unified with chat messages)
- Contacts management UI
- P2P networking via IoM connections
- Multi-device synchronization
- BLE/UDP discovery for mobile instances
- Real-time subject tracking across conversations

## Architecture

```
lama-electron-shadcn.js     # Main Electron process
├── Window Management (macOS hiddenInset)
├── IPC Handlers (UDP, App Data, System)
├── Custom Title Bar Injection
└── Dev/Production modes

main/                       # Node.js Backend
├── core/
│   ├── node-one-core.js   # Single Node.js ONE.core instance
│   ├── ai-assistant-model.js  # AI integration with analysis
│   ├── topic-group-manager.js # P2P and group chat management
│   └── one-ai/           # Topic analysis package
│       ├── models/       # Subject, Keyword, Summary models
│       └── services/     # Analysis and extraction services
├── services/
│   ├── llm-manager.js    # LLM provider with chatWithAnalysis
│   ├── mcp-manager.js    # MCP tool integration
│   └── html-export/      # HTML export with microdata
└── ipc/
    ├── controller.js      # IPC communication handler
    └── handlers/
        ├── chat.js        # Chat with deterministic IDs
        ├── topic-analysis.js  # AI analysis handlers
        └── export.js      # HTML export handler

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
- Windows: Windows 7 or later (for building Windows installers)
- macOS: macOS 10.13 or later (for building macOS installers)
- Linux: Ubuntu 16.04 or later (for building Linux packages)

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

#### Run in Production Mode
```bash
cd lama/electron-ui
npm run build
NODE_ENV=production npx electron lama-electron-shadcn.js
```

#### Build Installers

**Windows Installer (Single-file downloads):**
```bash
# Build NSIS installer (.exe with one-click installation)
npm run dist:win

# Build portable version (.exe that runs without installation)
npm run dist:win-portable

# Build both NSIS and portable versions
npm run dist:all
```

**macOS Installer:**
```bash
# Build DMG installer for macOS
npm run dist:mac
```

**Linux:**
```bash
# Build AppImage and deb packages
npm run dist:linux
```

Built installers will be available in the `dist/` folder:
- Windows: `LAMA-1.0.0-Installer.exe` (NSIS) or `LAMA-1.0.0-Portable.exe` (portable)
- macOS: `LAMA-1.0.0.dmg`
- Linux: `LAMA-1.0.0.AppImage` and `LAMA_1.0.0_amd64.deb`

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

### Recent Improvements (January 2025)

#### Performance Optimizations
- **LLM Cold Start Reduction**: Pre-warming connections reduce startup from 12+ seconds to <1 second
- **Contact Caching**: 5-second cache eliminates redundant API calls during initialization
- **Reduced Log Noise**: 80% reduction in startup logs through batching and filtering
- **Race Condition Fixes**: Proper mutex cleanup prevents topic creation conflicts
- **AI Topic Registration Fix**: Corrected initialization order ensures AI topics are properly registered for message listening

#### AI & Analysis
- **Combined Response + Analysis**: Single LLM call provides both user response and topic analysis
- **Non-blocking Processing**: Keywords and subjects extracted in background using `setImmediate()`
- **Context-Aware Extraction**: Focuses on meaning over message length
- **Automatic Subject Tracking**: Creates and manages conversation subjects dynamically

#### Topic Management
- **Deterministic IDs**: Topics use name-based IDs instead of timestamps
- **Duplicate Prevention**: Automatic validation ensures unique topic identifiers
- **No Spurious Creation**: Analysis calls no longer auto-create topics

#### Export Features
- **HTML with Microdata**: Export conversations with embedded ONE.core object references
- **Implode Integration**: Uses ONE.core's native `implode()` for complete data embedding
- **Self-contained Files**: HTML exports include all styling and metadata

### Internet of Me (IoM)
The app establishes a full Internet of Me using ONE.CORE and one.models:
- **Single Node.js Instance**: All ONE.core operations run in main process
- **LeuteModel** - Handles identity management and trust certificates
- **ChannelManager** - Manages data channels for synchronization
- **TopicGroupManager** - Handles P2P and group chat architectures

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