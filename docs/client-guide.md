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
<script src="http://localhost:10550/sockethub-client.js"></script>
```

These scripts set `io` and `SockethubClient` as globals.

**From npm**: `npm install @sockethub/client socket.io-client`

### Basic Setup

**Browser** (using globals from script tags):

```javascript
const sc = new SockethubClient(
    io('http://localhost:10550', { path: '/sockethub' }),
    { initTimeoutMs: 5000 },
);
```

**Node.js / bundler** (using ESM imports):

```javascript
import SockethubClient from '@sockethub/client';
import { io } from 'socket.io-client';

const sc = new SockethubClient(
    io('http://localhost:10550', { path: '/sockethub' }),
    { initTimeoutMs: 5000 },
);

// Handle messages
sc.socket.on('message', (msg) => console.log('Received:', msg));

sc.socket.on('ready', (info) => {
  console.log('Sockethub ready:', info.reason, info.sockethubVersion,
    info.platforms.map((p) => ({ id: p.id, version: p.version })));
});

sc.socket.on('init_error', (e) => {
  console.warn('Sockethub init issue:', e.error);
});
```

### First Message

```javascript
// Wait for schema registry before using contextFor()
try {
  await sc.ready();
} catch (err) {
  console.error('Sockethub failed to initialize:', err);
  return;
}

sc.socket.emit('message', {
  type: 'echo',
  '@context': sc.contextFor('dummy'),
  actor: { id: 'test', type: 'person' },
  object: { type: 'message', content: 'Hello!' }
}, (response) => {
  if (response?.error) {
    console.error('Send failed:', response.error);
    return;
  }
  console.log('Ack:', response);
});
```

**Important:** `contextFor()` requires the schema registry, so it can only be
called after `ready()` resolves. If you need to emit before `ready()`, provide
the `@context` array directly instead of using `contextFor()`. SockethubClient
queues outbound events and flushes them once initialization completes.

## Checking Results (Success/Failure)

### 1. Check the emit callback for request outcome

For client-initiated operations, pass a callback to `emit`. Treat any payload
with `error` as failure.

```javascript
sc.socket.emit('message', {
    type: 'send',
    '@context': sc.contextFor('irc'),
    actor: { id: 'mynick', type: 'person' },
    target: { id: '#sockethub', type: 'room' },
    object: { type: 'message', content: 'Hello channel' }
}, (result) => {
    if (result?.error) {
        console.error('Send failed:', result.error);
        return;
    }

    console.log('Send succeeded:', result);
});
```

This same pattern applies to `credentials` and `activity-object` events.

### 2. Listen for incoming platform events on `message`

Not all messages are direct responses to your last request. Platforms can also
push messages/events asynchronously.

```javascript
sc.socket.on('message', (msg) => {
    if (msg?.error) {
        console.warn('Incoming platform error:', msg.error, msg);
        return;
    }

    console.log('Incoming platform event:', msg);
});
```

### 3. Handle transport-level connection failures

```javascript
sc.socket.on('connect', () => console.log('Connected'));
sc.socket.on('disconnect', () => console.log('Disconnected'));
sc.socket.on('connect_error', (err) => console.error('Socket error:', err));
```

Use these to represent WebSocket health in your UI, separate from platform job
success/failure.

## Core Patterns

### ActivityStreams Format

```javascript
{
  "type": "send",            // Action: send, connect, join, fetch
  "@context": sc.contextFor("irc"),  // Canonical contexts for this platform
  "actor": { "id": "user", "type": "person" },     // Who
  "target": { "id": "#room", "type": "room" },     // Where (optional)
  "object": { "type": "message", "content": "Hi!" }   // What
}
```

If `actor` is provided as a string, Sockethub expands it using any previously
saved ActivityObject with the same id (including `type` and any other stored
properties). If none exists, it expands to `{ id }`.

### Setting ActivityObjects and Building ActivityStreams

The client includes `sc.ActivityStreams` helpers. This is the easiest way to
define reusable actor/target objects and then reference them by id.

```javascript
// Register an actor object (also emitted to server as `activity-object`)
sc.ActivityStreams.Object.create({
    id: 'mynick',
    type: 'person',
    name: 'My IRC Nick'
});

// Build a stream with string refs; they are expanded from stored objects
const joinStream = sc.ActivityStreams.Stream({
    type: 'join',
    '@context': sc.contextFor('irc'),
    actor: 'mynick',
    target: { id: '#sockethub', type: 'room' }
});

sc.socket.emit('message', joinStream, (result) => {
    if (result?.error) {
        console.error('Join failed:', result.error);
    }
});
```

You can still send raw ActivityStreams directly with `sc.socket.emit('message',
...)` if you prefer.

### Platforms Requiring Credentials

```javascript
await sc.ready();

// 1. Send credentials
sc.socket.emit('credentials', {
    '@context': sc.contextFor('irc'),
    type: 'credentials',
    actor: { id: 'mynick', type: 'person' },
    object: {
        type: 'credentials',
        nick: 'mynick',
        server: 'irc.libera.chat',
        secure: true
        // password: 'secret'           // SASL PLAIN (traditional password)
        // token: 'oauth-access-token', // SASL OAUTHBEARER — mutually exclusive with password
        // saslMechanism: 'OAUTHBEARER' // optional; inferred from token/password
    }
});

// 2. Connect
sc.socket.emit('message', {
    type: 'connect',
    '@context': sc.contextFor('irc'),
    actor: { id: 'mynick', type: 'person' }
});
```

The XMPP platform accepts a single `password` field. If your deployment expects
a pre-issued auth token in the SASL PLAIN password slot, pass that token
string as `password`. This is only compatible with deployments that explicitly
accept bearer-style tokens there.
See [packages/platform-xmpp/README.md](../packages/platform-xmpp/README.md#authentication)
for the full credential reference.

```javascript
// XMPP using a bearer-style token string in the password slot
sc.socket.emit('credentials', {
    '@context': sc.contextFor('xmpp'),
    type: 'credentials',
    actor: { id: 'user@jabber.net', type: 'person' },
    object: {
        type: 'credentials',
        userAddress: 'user@jabber.net',
        password: 'pre-issued-auth-token',
        resource: 'phone'
    }
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
    '@context': sc.contextFor('dummy'),
    actor: { id: 'test', type: 'person' },
    object: { type: 'message', content: 'test' }
});
```

### Feeds (RSS/Atom)

```javascript
sc.socket.emit('message', {
    type: 'fetch',
    '@context': sc.contextFor('feeds'),
    actor: { id: 'https://example.com/feed.xml', type: 'feed' }
});
```

### IRC (Chat)

```javascript
// Join channel
sc.socket.emit('message', {
    type: 'join',
    '@context': sc.contextFor('irc'),
    actor: { id: 'mynick', type: 'person' },
    target: { id: '#channel', type: 'room' }
});
```

## Client Features

- **Schema-driven init**: `ready()` resolves when the server's schema registry is loaded
- **Context composition**: `contextFor(platform)` builds canonical `@context` arrays
- **Outbound queueing**: Messages sent before `ready()` are queued and flushed automatically
- **Auto-replay**: Credentials and connections restored on reconnect
- **ActivityStreams**: Built-in validation and utilities via `sc.ActivityStreams`
- **Connection state**: Check `sc.socket.connected` for status

## Reference

- **[Client Package](../packages/client/)** - Full API documentation
- **[ActivityStreams Package](../packages/activity-streams/)** - ActivityStreams utilities and validation
- **[ActivityStreams Spec](https://www.w3.org/TR/activitystreams-core/)** - Message format specification
