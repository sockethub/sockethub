# @sockethub/client

JavaScript client for [Sockethub](https://github.com/sockethub/sockethub) - a protocol
gateway that translates ActivityStreams messages into various protocols (XMPP, IRC, RSS, etc.).

Works in Node.js and browsers.

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
const sc = SockethubClient(io(SOCKETHUB_SERVER));
```

#### ESM

```javascript
import SockethubClient from '@sockethub/client';
import { io } from '@socket.io-client';
const SOCKETHUB_SERVER = 'http://localhost:10550';
const sc = SockethubClient(io(SOCKETHUB_SERVER));
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
const client = new SockethubClient(socket);

client.socket.on('message', (msg) => console.log(msg));
```

See the [Client Guide](../../docs/client-guide.md) for detailed usage and examples.

## API

- **`new SockethubClient(socket)`** - Create client instance
- **`client.socket.emit(event, data)`** - Send messages
- **`client.socket.on(event, handler)`** - Listen for messages
- **`client.clearCredentials()`** - Clear stored credentials
- **`client.ActivityStreams`** - ActivityStreams library

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
