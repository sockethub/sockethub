# @sockethub/client

The Sockethub client is a small JavaScript SDK for app developers to connect to a
Sockethub server via Socket.IO and send/receive ActivityStreams messages. It works
in both Node.js and browsers, with schema-driven validation, automatic
reconnection, and credential replay.

## What's Included

- `SockethubClient` for connection and message handling
- Schema-driven validation of outbound ActivityStreams messages (via `@sockethub/schemas`)
- `contextFor(platform)` builds canonical `@context` arrays from server metadata
- `ready()` promise and `ready`/`init_error` observability events
- Automatic outbound queuing until initialization is complete
- Auto-replay of credentials and connections on reconnect
- A browser-ready bundle in `dist/`

## How It Works

`SockethubClient` wraps a [Socket.IO](https://socket.io) connection and manages
everything between your app and the Sockethub server:

1. **Schema registry handshake.** On connect (and every reconnect) the client
   requests the server's *platform schema registry* — the contexts, versions,
   and JSON schemas for each platform the server has loaded. It caches that
   registry along with a content fingerprint the server provides. On reconnect
   the client echoes the fingerprint; if nothing has changed the server replies
   `unchanged` instead of re-sending the full schema set, so the (potentially
   large) registry crosses the wire only when it actually changes.
2. **Initialization lifecycle.** `ready()` resolves once the registry is
   applied; `getInitState()` and the `ready` / `init_error` events expose the
   same lifecycle. Outbound events emitted before the client is ready are queued
   in memory and flushed automatically once initialization completes.
3. **Message handling.** Outgoing `message`/`credentials` events are normalized
   (string `actor`/`target` references are expanded to objects) and validated
   against the originating platform's schema before they leave the client;
   incoming platform events are normalized before being handed to your
   `message` listener. Validation uses the same schemas the server enforces, so
   malformed activities are caught locally rather than round-tripping.
4. **Context composition.** `contextFor(platform)` builds the canonical
   `@context` array for a platform from the cached registry.
5. **Reconnect resilience.** Credentials, platform connections, and room joins
   are kept in memory and replayed when the socket reconnects (see
   [Security & State Management](#security--state-management)).

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

const sc = new SockethubClient(io('http://localhost:10550', { path: '/sockethub' }));
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

Send a full `actor` object on each `credentials` and `message` event.

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

## Sending messages

Include `id`, `type`, and usually `name` on the `actor` for `credentials` and
`message` events. Before sending, the client validates each outgoing activity
against the originating platform's schema from the server registry, surfacing a
client-side error instead of dispatching a malformed message.

```javascript
sc.socket.emit("message", {
    type: "join",
    "@context": sc.contextFor("irc"),
    actor: { id: "mynick", type: "person", name: "My IRC Nick" },
    target: { id: "#sockethub", type: "room" },
}, (result) => {
    if (result?.error) console.error(result.error);
});
```

## Security & State Management

### Automatic Reconnection

The SockethubClient automatically handles brief network disconnections by storing connection state in
memory and replaying it when the connection is re-established.

#### What Gets Stored

- Credentials (passwords, tokens, API keys)
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
