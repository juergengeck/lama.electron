# Changelog

All notable changes to LAMA Electron will be documented in this file.

## [Unreleased] - 2025-01-23

### Added
- **Combined LLM Response + Analysis**: Single API call now generates both user response and topic analysis
- **HTML Export with Microdata**: Export conversations with embedded ONE.core object references
- **Topic Analysis Models**: Subject, Keyword, and Summary models for conversation analysis
- **MCP Tool Integration**: Model Context Protocol tools for filesystem operations
- **LLM Pre-warming**: Connection pre-warming to reduce cold start delays
- **Contact Caching**: 5-second cache for contact retrieval operations

### Changed
- **Topic ID Generation**: Now uses deterministic name-based IDs instead of timestamps
- **Keyword Extraction**: Context-aware extraction focusing on meaning over message length
- **Analysis Processing**: Keywords and subjects now processed in background using `setImmediate()`
- **Log Output**: Reduced startup logs by 80% through batching and filtering

### Fixed
- **Topic Creation Race Condition**: Added proper mutex cleanup in finally blocks
- **Topic Spillover**: Fixed message isolation between different topics
- **Duplicate Topic IDs**: Added validation to prevent duplicate topic identifiers
- **Auto-creation Bug**: Topic analysis no longer creates topics when checking messages

### Performance
- **LLM Cold Start**: Reduced from 12+ seconds to <1 second
- **Redundant API Calls**: Eliminated 6x redundant `getContacts` calls during initialization
- **Response Latency**: User responses stream immediately while analysis happens in background

## [0.9.0] - 2025-01-20

### Added
- Full ONE.CORE integration with Internet of Me (IoM)
- Real-time IOM replication monitoring dashboard
- CHUM protocol sync status tracking
- Live storage metrics from system resources
- AI chat interface with multiple LLM providers
- Conversations management with persistence

### Infrastructure
- Single Node.js ONE.core instance architecture
- Clean separation between transport and protocol layers
- Deterministic channel management for P2P and group chats
- Topic-based message aggregation

## [0.8.0] - 2025-01-15

### Initial Release
- Electron app with custom macOS title bar
- MultiUser authentication system
- Settings with AI provider configuration
- Development hot-reload with Vite
- IPC communication for UDP and native features
- App data reset with automatic restart