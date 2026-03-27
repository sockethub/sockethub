# @sockethub/client

The Sockethub client is a small JavaScript SDK for app developers to connect to a
Sockethub server via Socket.IO and send/receive ActivityStreams messages. It works
in both Node.js and browsers, and provides helpers for ActivityStreams along with
automatic reconnection and credential replay.

## What's Included

- `SockethubClient` for connection and message handling
- `ActivityStreams` helpers and validation utilities
- `contextFor(platform)` builds canonical `@context` arrays from server metadata
- `ready()` promise and `ready`/`init_error` observability events
- Automatic outbound queueing until initialization is complete
- Auto-replay of credentials and connections on reconnect
- A browser-ready bundle in `dist/`

## Install

### Node.js

`$ npm install @sockethub/client socket.io-client`

### Bun

`$ bun install @sockethub/client socket.io-client`

```javascript
import SockethubClient from '@sockethub/client';
import { io } from 'socket.io-client';
const SOCKETHUB_SERVER = 'http://localhost:10550';
const sc = new SockethubClient(io(SOCKETHUB_SERVER));
```

### Browser

Two browser builds are published in `dist/`:

- `dist/sockethub-client.browser.js` is the IIFE/global build for plain `<script>` tags
- `dist/sockethub-client.js` is the ESM build for `<script type="module">`

If you are serving assets from a Sockethub server, use the pre-copied global build
at `/sockethub-client.js` along with `/socket.io.js`:

```html
<script src="/socket.io.js"></script>
<script src="/sockethub-client.js"></script>
```

These scripts set `io` and `SockethubClient` as globals.

If you are hosting the package files yourself and want ESM instead, serve
`dist/sockethub-client.js` and import it from a module script:

```html
<script type="module">
import SockethubClient from '/dist/sockethub-client.js';
import { io } from '/socket.io.esm.min.js';

const sc = new SockethubClient(io('http://localhost:10550'));
</script>
```

## Quick Start

```javascript
import SockethubClient from '@sockethub/client';
import { io } from 'socket.io-client';

const socket = io('http://localhost:10550', { path: '/sockethub' });
const sc = new SockethubClient(socket, { initTimeoutMs: 5000 });

sc.socket.on('message', (msg) => console.log(msg));
sc.socket.on('ready', (info) => {
    console.log('Sockethub ready:', info.reason, info.sockethubVersion,
        info.platforms.map((p) => ({ id: p.id, version: p.version })));
});
sc.socket.on('init_error', (e) => {
    console.warn('Sockethub init issue:', e.error);
});

// Wait for schema registry, then send a message
try {
    await sc.ready();
    sc.socket.emit('message', {
        '@context': sc.contextFor('dummy'),
        type: 'echo',
        actor: { id: 'test@dummy', type: 'person' },
        object: { type: 'message', content: 'hello world' }
    }, (ack) => {
        if (ack?.error) {
            console.error('Send failed:', ack.error);
            return;
        }
        console.log('Ack:', ack);
    });
} catch (err) {
    console.error('Sockethub failed to initialize:', err);
}
```

See the [Client Guide](../../docs/client-guide.md) for detailed usage and examples.

## API

- **`new SockethubClient(socket, options?)`** - Create client instance with optional init/queue settings
- **`sc.ready(timeoutMs?)`** - Wait for initialization to complete
- **`sc.isReady()`** - Check whether client is initialized
- **`sc.getInitState()`** - Return `"idle" | "initializing" | "ready" | "init_error" | "closed"`
- **`sc.contextFor(platform)`** - Build canonical `@context` for a platform from server registry
- **`sc.getRegisteredPlatforms()`** - Get server-registered platforms/contexts
- **`sc.getRegisteredBaseContexts()`** - Get AS2 and Sockethub base context URLs
- **`sc.getPlatformSchema(platform, schemaType?)`** - Get platform JSON schema
- **`sc.validateActivity(activity)`** - Validate against registered schemas
- **`sc.socket.emit(event, data, callback)`** - Send messages (queued until ready)
- **`sc.socket.on(event, handler)`** - Listen for messages
- **`sc.clearCredentials()`** - Clear stored credentials
- **`sc.ActivityStreams`** - ActivityStreams library

## Result Handling

For client-initiated requests, pass a callback to `emit` and treat an `error`
field as failure:

```javascript
sc.socket.emit("message", {
    type: "echo",
    "@context": sc.contextFor("dummy"),
    actor: { id: "test", type: "person" },
    object: { type: "message", content: "Hello!" },
}, (result) => {
    if (result?.error) {
        console.error("Sockethub request failed:", result.error);
        return;
    }

    console.log("Sockethub request succeeded:", result);
});
```

Also listen for ongoing platform events:

```javascript
sc.socket.on("message", (msg) => {
    console.log("incoming platform event:", msg);
});
```

## ActivityStreams Helpers

Define reusable objects via `ActivityStreams.Object.create(...)`, then build
streams with `ActivityStreams.Stream(...)`:

```javascript
sc.ActivityStreams.Object.create({
    id: "mynick",
    type: "person",
    name: "My IRC Nick",
});

const stream = sc.ActivityStreams.Stream({
    type: "join",
    "@context": sc.contextFor("irc"),
    actor: "mynick",
    target: { id: "#sockethub", type: "room" },
});

sc.socket.emit("message", stream, (result) => {
    if (result?.error) console.error(result.error);
});
```

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
