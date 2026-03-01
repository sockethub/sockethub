# @sockethub/client

The Sockethub client is a small JavaScript SDK for app developers to connect to a
Sockethub server via Socket.IO and send/receive ActivityStreams messages. It works
in both Node.js and browsers, and provides helpers for ActivityStreams along with
automatic reconnection and credential replay.

## What's Included

- `SockethubClient` for connection and message handling
- `ActivityStreams` helpers and validation utilities
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
const sc = new SockethubClient(socket);

sc.socket.on('message', (msg) => console.log(msg));
```

See the [Client Guide](../../docs/client-guide.md) for detailed usage and examples.

## API

- **`new SockethubClient(socket)`** - Create client instance
- **`sc.socket.emit(event, data, callback)`** - Send messages and inspect result
- **`sc.socket.on(event, handler)`** - Listen for messages
- **`sc.clearCredentials()`** - Clear stored credentials
- **`sc.ActivityStreams`** - ActivityStreams library

## Result Handling

For client-initiated requests, pass a callback to `emit` and treat an `error`
field as failure:

```javascript
sc.socket.emit("message", {
    type: "send",
    context: "dummy",
    actor: { id: "test", type: "person" },
    object: { type: "note", content: "Hello!" },
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
    context: "irc",
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
