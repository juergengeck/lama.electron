# IPC Architecture for ONE.CORE in Electron

## Overview

ONE.CORE runs in the Electron main process with full Node.js access, while the UI runs in the renderer process. All ONE.CORE operations must go through IPC (Inter-Process Communication).

## Architecture

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│     MAIN PROCESS            │     │     RENDERER PROCESS        │
│                             │     │                             │
│  ┌──────────────────────┐   │     │  ┌──────────────────────┐   │
│  │   ONE.CORE (Node.js) │   │     │  │   React UI          │   │
│  │   - Instance         │   │     │  │   - Components      │   │
│  │   - Storage          │   │◄────┼──┤   - Views           │   │
│  │   - Crypto           │   │ IPC │  │   - Models          │   │
│  │   - Networking       │   │     │  └──────────────────────┘   │
│  └──────────────────────┘   │     │            │                │
│             │               │     │            ▼                │
│             ▼               │     │  ┌──────────────────────┐   │
│  ┌──────────────────────┐   │     │  │  IPC Client         │   │
│  │   IPC Handlers       │   │     │  │  (one-core-client)  │   │
│  │   - Auth handlers    │   │◄────┼──┤  - Async calls      │   │
│  │   - Storage handlers │   │     │  │  - Type safety      │   │
│  │   - Object handlers  │   │     │  │  - Error handling   │   │
│  └──────────────────────┘   │     │  └──────────────────────┘   │
└─────────────────────────────┘     └─────────────────────────────┘
```

## IPC Channels

### Authentication & Instance Management

#### `one-core:init`
- **Direction**: Renderer → Main
- **Purpose**: Initialize ONE.CORE platform and storage
- **Request**: `void`
- **Response**: `boolean` (success)

#### `one-core:createInstance`
- **Direction**: Renderer → Main
- **Purpose**: Create or load ONE instance with keys
- **Request**: `{ password?: string }`
- **Response**: `{ instanceId: string, ownerId: string }`

#### `one-core:login`
- **Direction**: Renderer → Main
- **Purpose**: Login with username/password
- **Request**: `{ username: string, password: string }`
- **Response**: `{ success: boolean, instanceId?: string, ownerId?: string, error?: string }`

#### `one-core:register`
- **Direction**: Renderer → Main
- **Purpose**: Register new user
- **Request**: `{ username: string, password: string, email?: string }`
- **Response**: `{ success: boolean, instanceId?: string, ownerId?: string, error?: string }`

#### `one-core:logout`
- **Direction**: Renderer → Main
- **Purpose**: Logout current user
- **Request**: `void`
- **Response**: `{ success: boolean }`

#### `one-core:getInstance`
- **Direction**: Renderer → Main
- **Purpose**: Get current instance info
- **Request**: `void`
- **Response**: `{ instanceId: string, ownerId: string, publicKey: string } | null`

### Storage Operations

#### `one-core:storage:get`
- **Direction**: Renderer → Main
- **Purpose**: Get object from storage
- **Request**: `{ hash: string }`
- **Response**: `{ data: any } | null`

#### `one-core:storage:set`
- **Direction**: Renderer → Main
- **Purpose**: Store object
- **Request**: `{ data: any, type: string }`
- **Response**: `{ hash: string }`

#### `one-core:storage:query`
- **Direction**: Renderer → Main
- **Purpose**: Query objects by type
- **Request**: `{ type: string, filter?: object }`
- **Response**: `{ objects: Array<{hash: string, data: any}> }`

### Object Operations

#### `one-core:createObject`
- **Direction**: Renderer → Main
- **Purpose**: Create a ONE object
- **Request**: `{ type: string, data: any }`
- **Response**: `{ hash: string, object: any }`

#### `one-core:getObject`
- **Direction**: Renderer → Main
- **Purpose**: Get object by hash
- **Request**: `{ hash: string }`
- **Response**: `{ object: any } | null`

#### `one-core:updateObject`
- **Direction**: Renderer → Main
- **Purpose**: Update existing object (creates new version)
- **Request**: `{ hash: string, updates: any }`
- **Response**: `{ newHash: string, object: any }`

### Channel Operations

#### `one-core:channel:create`
- **Direction**: Renderer → Main
- **Purpose**: Create new channel
- **Request**: `{ name: string, type: string }`
- **Response**: `{ channelId: string, channel: any }`

#### `one-core:channel:join`
- **Direction**: Renderer → Main
- **Purpose**: Join existing channel
- **Request**: `{ channelId: string }`
- **Response**: `{ success: boolean, channel?: any }`

#### `one-core:channel:post`
- **Direction**: Renderer → Main
- **Purpose**: Post message to channel
- **Request**: `{ channelId: string, message: any }`
- **Response**: `{ messageHash: string }`

#### `one-core:channel:getMessages`
- **Direction**: Renderer → Main
- **Purpose**: Get channel messages
- **Request**: `{ channelId: string, limit?: number, offset?: number }`
- **Response**: `{ messages: Array<any> }`

### Network Operations

#### `one-core:network:connect`
- **Direction**: Renderer → Main
- **Purpose**: Connect to CommServer or peer
- **Request**: `{ url: string, options?: any }`
- **Response**: `{ connectionId: string, status: string }`

#### `one-core:network:disconnect`
- **Direction**: Renderer → Main
- **Purpose**: Disconnect from server/peer
- **Request**: `{ connectionId: string }`
- **Response**: `{ success: boolean }`

#### `one-core:network:status`
- **Direction**: Renderer → Main
- **Purpose**: Get network status
- **Request**: `void`
- **Response**: `{ connections: Array<{id: string, url: string, status: string}> }`

## Events (Main → Renderer)

### `one-core:event:connectionStatus`
- **Purpose**: Network connection status changed
- **Data**: `{ connectionId: string, status: string }`

### `one-core:event:objectCreated`
- **Purpose**: New object created
- **Data**: `{ hash: string, type: string, object: any }`

### `one-core:event:channelMessage`
- **Purpose**: New message in channel
- **Data**: `{ channelId: string, message: any }`

### `one-core:event:syncProgress`
- **Purpose**: Sync progress update
- **Data**: `{ progress: number, total: number, status: string }`

## Implementation Files

### Main Process
- `/main-one-core.js` - ONE.CORE initialization and IPC handlers
- `/lama-electron-shadcn.js` - Main process entry, loads IPC handlers

### Renderer Process
- `/electron-ui/src/services/one-core-client.ts` - IPC client wrapper
- `/electron-ui/src/initialization/index.ts` - App initialization using IPC

### Preload Script
- `/electron-preload.js` - Exposes IPC methods to renderer

## Error Handling

All IPC calls should handle errors gracefully:

```typescript
// In renderer
try {
  const result = await oneCoreClient.login(username, password);
  if (result.success) {
    // Handle success
  } else {
    // Handle error
    console.error('Login failed:', result.error);
  }
} catch (error) {
  // Handle IPC failure
  console.error('IPC error:', error);
}
```

```javascript
// In main process
ipcMain.handle('one-core:login', async (event, { username, password }) => {
  try {
    // Perform login
    const result = await oneCore.login(username, password);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

## Security Considerations

1. **Input Validation**: Always validate input in the main process
2. **No Direct Exposure**: Never expose ONE.CORE objects directly to renderer
3. **Sanitize Data**: Sanitize all data passed between processes
4. **Rate Limiting**: Consider rate limiting for sensitive operations
5. **Authentication Check**: Verify authentication state for protected operations

## Testing

### Unit Tests
- Test IPC handlers in isolation
- Mock ONE.CORE for handler tests
- Test client wrapper methods

### Integration Tests
- Test full IPC flow
- Test error scenarios
- Test concurrent operations

## Future Enhancements

1. **Batch Operations**: Support batch queries and updates
2. **Streaming**: Stream large data sets
3. **Caching**: Implement caching layer in renderer
4. **Offline Support**: Queue operations when offline
5. **Real-time Updates**: WebSocket bridge for real-time updates
6. **Performance Monitoring**: Track IPC performance metrics