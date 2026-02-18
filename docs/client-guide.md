# Client Guide

Practical guide to using the Sockethub client library in web applications.

## Quick Start

### Installation

You can load the client directly from a running Sockethub server or install it
from npm/bun for bundling in your app.

**From Sockethub Server** (recommended):

The client library is automatically served by the Sockethub server:

```html
<script src="http://localhost:10550/socket.io.js"></script>
<script src="http://localhost:10550/sockethub-client.js" type="module"></script>
```

**From npm**: `npm install @sockethub/client socket.io-client`

### Basic Setup

```javascript
import SockethubClient from '/sockethub-client.js';
import { io } from '/socket.io.js';

const sc = new SockethubClient(
    io('http://localhost:10550', { path: '/sockethub' })
);

// Handle messages
sc.socket.on('message', (msg) => console.log('Received:', msg));
```

### First Message

```javascript
// Echo test with dummy platform
sc.socket.emit('message', {
    type: 'echo',
    context: 'dummy',
    actor: { id: 'test', type: 'person' },
    object: { type: 'note', content: 'Hello!' }
}, (response) => console.log(response));
```

## Core Patterns

### ActivityStreams Format

```javascript
{
  "type": "send",            // Action: send, connect, join, fetch
  "context": "irc",          // Platform: irc, xmpp, feeds, dummy  
  "actor": { "id": "user", "type": "person" },     // Who
  "target": { "id": "#room", "type": "room" },     // Where (optional)
  "object": { "type": "note", "content": "Hi!" }   // What
}
```

If `actor` is provided as a string, Sockethub expands it using any previously
saved ActivityObject with the same id (including `type` and any other stored
properties). If none exists, it expands to `{ id }`.

### Platforms Requiring Credentials

```javascript
// 1. Send credentials
sc.socket.emit('credentials', {
    context: 'irc',
    actor: { id: 'mynick', type: 'person' },
    object: {
        type: 'credentials',
        nick: 'mynick',
        server: 'irc.libera.chat',
        secure: true
    }
});

// 2. Connect
sc.socket.emit('message', {
    type: 'connect',
    context: 'irc',
    actor: { id: 'mynick', type: 'person' }
});
```

### Anonymous IRC Username Collisions

If two sockets use the same IRC actor (same `context` + `actor.id`) without a
password, Sockethub does not allow them to share one running IRC session.

The rejected request returns an ActivityStream response with an `error`:

```json
{
  "context": "irc",
  "type": "connect",
  "actor": { "id": "mynick", "type": "person" },
  "id": "1",
  "error": "username already in use"
}
```

Client apps should treat any callback payload containing `error` as a failed
action and reset UI state accordingly (for example, re-enable a connect button).

Small exception: after a browser refresh, a reconnect from the same client IP
may still be allowed while the old stale socket is waiting for janitor cleanup.

## Platform Examples

### Dummy (Testing)

```javascript
sc.socket.emit('message', {
    type: 'echo',
    context: 'dummy',
    actor: { id: 'test', type: 'person' },
    object: { type: 'note', content: 'test' }
});
```

### Feeds (RSS/Atom)

```javascript
sc.socket.emit('message', {
    type: 'fetch',
    context: 'feeds',
    actor: { id: 'https://example.com/feed.xml', type: 'website' }
});
```

### IRC (Chat)

```javascript
// Join channel
sc.socket.emit('message', {
    type: 'join',
    context: 'irc',
    actor: { id: 'mynick', type: 'person' },
    target: { id: '#channel', type: 'room' }
});
```

## Client Features

- **Auto-replay**: Credentials and connections restored on reconnect
- **ActivityStreams**: Built-in validation and utilities via `sc.ActivityStreams`
- **Connection state**: Check `sc.socket.connected` for status

## Reference

- **[Client Package](../packages/client/)** - Full API documentation
- **[ActivityStreams Package](../packages/activity-streams/)** - ActivityStreams utilities and validation
- **[ActivityStreams Spec](https://www.w3.org/TR/activitystreams-core/)** - Message format specification
