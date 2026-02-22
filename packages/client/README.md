# @sockethub/client

The Sockethub client is a small JavaScript SDK for app developers to connect to a
Sockethub server via Socket.IO and send/receive ActivityStreams messages. It works
in both Node.js and browsers, and provides helpers for ActivityStreams along with
automatic reconnection and credential replay.

## What's Included

- `SockethubClient` for connection and message handling
- `ActivityStreams` helpers and validation utilities
- `contextFor(platform)` helper driven by server-provided schema metadata
- Internal initialization and ready-state management (no app-level `schemas` wiring required)
- `ready()` promise and `ready`/`init_error` observability events
- Automatic outbound queueing until initialization is complete
- Automatic schema registry sync from server (`schemas` event remains available for diagnostics)
- Auto-replay of credentials and connections on reconnect
- A browser-ready bundle in `dist/`

## Install

### Node.js

`$ npm install @sockethub/client`

### Bun

`$ bun install @sockethub/client`

#### CommonJS

```javascript
const SockethubClient = require('@sockethub/client');
const io = require('@socket.io-client');
const SOCKETHUB_SERVER = 'http://localhost:10550';
const sc = new SockethubClient(io(SOCKETHUB_SERVER));
```

#### ESM

```javascript
import SockethubClient from '@sockethub/client';
import { io } from '@socket.io-client';
const SOCKETHUB_SERVER = 'http://localhost:10550';
const sc = new SockethubClient(io(SOCKETHUB_SERVER));
```

### Browser

The browser bundle is available in the dist folder:

```
import '@sockethub/client/dist/sockethub-client.js';
```

You can place it somewhere accessible from the web and include
it via a `script` tag.

```
<script src="http://example.com/sockethub-client.js" type="module"></script>
```

Once included in a web-page, the `SockethubClient` base object
should be on the global scope.

## Quick Start

```javascript
import SockethubClient from '@sockethub/client';
import { io } from 'socket.io-client';

const socket = io('http://localhost:10550', { path: '/sockethub' });
const sc = new SockethubClient(socket, { initTimeoutMs: 5000 });

sc.socket.on('message', (msg) => console.log(msg));
sc.socket.on('ready', (info) => {
    console.log(
        'Sockethub ready:',
        info.reason,
        info.sockethubVersion,
        info.platforms.map((p) => ({
            id: p.id,
            version: p.version,
            contextVersion: p.contextVersion,
            schemaVersion: p.schemaVersion,
        })),
    );
    // prints:
    // Sockethub ready: initial-connect 5.0.0-alpha.11 [
    //   { id: 'dummy', version: '3.0.0-alpha.11', contextVersion: '1', schemaVersion: '1' },
    //   { id: 'xmpp', version: '5.0.0-alpha.11', contextVersion: '1', schemaVersion: '3' }
    // ]
});

sc.socket.on('init_error', (e) => {
    console.warn('Sockethub init issue:', e.error);
    // prints:
    // Sockethub init issue: Initialization timed out after 5000ms waiting for schemas
});

// SockethubClient also logs its own timeout/recovery warnings while blocked.
// prints:
// [SockethubClient] Initialization timed out after 5000ms;
// queued outbound messages: 3. Waiting for schemas event from server.
// [SockethubClient] Still waiting for schemas; queued outbound messages: 3; oldest queued age: 12.4s.
// [SockethubClient] Initialization recovered; flushing 3 queued messages after 13.1s delay.

// You may emit immediately. SockethubClient queues outbound events until ready.
await sc.ready();
// prints: (no output on success; promise resolves once schemas are loaded)
// Note: call ready() before using contextFor(platform).
sc.socket.emit('message', {
    '@context': sc.contextFor('dummy'),
    type: 'echo',
    actor: { id: 'test@dummy', type: 'person' },
    object: { type: 'message', content: 'hello world' }
}, (ack) => {
    if (ack?.error) {
        console.error('Send failed:', ack.error);
        // prints (example):
        // Send failed: SockethubClient validation failed: ...
        return;
    }
    console.log('Ack:', ack?.type, ack?.platform);
    // prints:
    // Ack: echo dummy
});
```

See the [Client Guide](../../docs/client-guide.md) for detailed usage and examples.

## API

- **`new SockethubClient(socket)`** - Create client instance
- **`new SockethubClient(socket, options?)`** - Create client instance with optional init/queue settings
- **`sc.ready(timeoutMs?)`** - Wait for initialization to complete
- **`sc.isReady()`** - Check whether client is initialized
- **`sc.getInitState()`** - Return `"idle" | "initializing" | "ready" | "init_error" | "closed"`
- **`sc.contextFor(platform)`** - Build canonical `@context` for a platform from server registry
- **`sc.isSchemasReady()`** - Alias for `sc.isReady()` (compatibility)
- **`sc.waitForSchemas(timeoutMs?)`** - Alias for `sc.ready()` (compatibility)
- **`sc.getRegisteredPlatforms()`** - Get server-registered platforms/contexts
- **`sc.getRegisteredBaseContexts()`** - Get server-registered AS2 and Sockethub base context URLs
- **`sc.getPlatformSchema(platform, schemaType?)`** - Get platform message/credentials schema
- **`sc.validateActivity(activity)`** - Validate an activity against registered schemas
- **`sc.socket.emit(event, data)`** - Send messages (queued until ready)
- **`sc.socket.on(event, handler)`** - Listen for messages
- **`sc.clearCredentials()`** - Clear stored credentials
- **`sc.ActivityStreams`** - ActivityStreams library

## Security & State Management

### Automatic Reconnection

The SockethubClient automatically handles brief network disconnections by storing connection state in
memory and replaying it when the connection is re-established.

#### What Gets Stored

- Credentials (passwords, tokens, API keys)
- Actor definitions
- Platform connections
- Channel/room joins

#### Storage Location

**All state is stored ONLY in JavaScript memory.** Nothing is persisted to:

- localStorage
- sessionStorage
- Cookies
- IndexedDB
- Disk

#### Lifetime

State exists only during the current browser tab session:

- ✅ Survives brief network interruptions
- ❌ Cleared on page refresh
- ❌ Cleared when tab closes
- ❌ Not shared between tabs

#### Server Restart Behavior

If the Sockethub server restarts:

1. Client socket will automatically reconnect
2. Client will replay stored credentials
3. **Server must validate replayed credentials** (may be expired/revoked)
4. Server should implement session validation to handle stale replays

#### Disabling Automatic Replay

If you need to disable automatic credential replay for security reasons:

```javascript
// Clear credentials before they can be replayed
sc.socket.on('disconnect', () => {
    sc.clearCredentials();
});
```
