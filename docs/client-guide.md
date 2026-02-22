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
    io('http://localhost:10550', { path: '/sockethub' }),
    { initTimeoutMs: 5000 },
);

// Handle messages
sc.socket.on('message', (msg) => console.log('Received:', msg));

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

// SockethubClient also prints internal timeout/recovery warnings:
// prints:
// [SockethubClient] Initialization timed out after 5000ms;
// queued outbound messages: 3. Waiting for schemas event from server.
// [SockethubClient] Still waiting for schemas; queued outbound messages: 3; oldest queued age: 12.4s.
// [SockethubClient] Initialization recovered; flushing 3 queued messages after 13.1s delay.
```

### First Message

```javascript
// Optional: explicitly await ready once
await sc.ready();

sc.socket.emit('message', {
  type: 'echo',
  '@context': sc.contextFor('dummy'),
  actor: { id: 'test', type: 'person' },
  object: { type: 'note', content: 'Hello!' }
}, (response) => {
  if (response?.error) {
    console.error('Send failed:', response.error);
    // prints (example):
    // Send failed: SockethubClient validation failed: ...
    return;
  }
  console.log('Ack:', response?.type, response?.platform);
  // prints:
  // Ack: echo dummy
});
```

You can also emit before `ready()` resolves. SockethubClient queues outbound
events and flushes them once initialization completes.

## Core Patterns

### ActivityStreams Format

```javascript
{
  "type": "send",            // Action: send, connect, join, fetch
  "@context": sc.contextFor("irc"),  // Canonical contexts for this platform
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
    '@context': sc.contextFor('irc'),
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
    '@context': sc.contextFor('irc'),
    actor: { id: 'mynick', type: 'person' }
});
```

## Platform Examples

### Dummy (Testing)

```javascript
sc.socket.emit('message', {
    type: 'echo',
    '@context': sc.contextFor('dummy'),
    actor: { id: 'test', type: 'person' },
    object: { type: 'note', content: 'test' }
});
```

### Feeds (RSS/Atom)

```javascript
sc.socket.emit('message', {
    type: 'fetch',
    '@context': sc.contextFor('feeds'),
    actor: { id: 'https://example.com/feed.xml', type: 'website' }
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

- **Auto-replay**: Credentials and connections restored on reconnect
- **ActivityStreams**: Built-in validation and utilities via `sc.ActivityStreams`
- **Connection state**: Check `sc.socket.connected` for status

## Reference

- **[Client Package](../packages/client/)** - Full API documentation
- **[ActivityStreams Package](../packages/activity-streams/)** - ActivityStreams utilities and validation
- **[ActivityStreams Spec](https://www.w3.org/TR/activitystreams-core/)** - Message format specification
