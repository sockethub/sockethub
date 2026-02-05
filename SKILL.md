---
name: sockethub
description: Bridges web applications to messaging protocols (IRC, XMPP, RSS/Atom) via
  ActivityStreams. Use when building chat clients, connecting to IRC channels, sending
  XMPP messages, fetching RSS feeds, or creating protocol-agnostic messaging applications.
---

# Sockethub

A polyglot messaging gateway that translates ActivityStreams messages to
protocol-specific formats, enabling browser JavaScript to communicate with IRC,
XMPP, and feed services.

## When to Use

Invoke when you need to:

- Connect a web application to IRC networks or XMPP servers
- Build a browser-based chat client for multiple protocols
- Fetch and parse RSS/Atom feeds from JavaScript
- Send messages across different messaging platforms
- Create protocol-agnostic messaging applications
- Handle real-time bidirectional communication with legacy protocols
- Generate metadata previews for shared URLs

## Quick Start

### Server Setup

```bash
# Install globally
bun add -g sockethub@alpha

# Start server (requires Redis)
sockethub --port 10550

# Or run with Docker
docker run -d --name redis redis
sockethub
```

### Client Connection

```javascript
import SockethubClient from '@sockethub/client';
import { io } from 'socket.io-client';

const socket = io('http://localhost:10550', { path: '/sockethub' });
const sc = new SockethubClient(socket);

// Listen for messages
sc.socket.on('message', (msg) => console.log(msg));

// Send ActivityStreams message
sc.socket.emit('message', {
  context: 'irc',
  type: 'send',
  actor: 'myuser@irc.libera.chat',
  target: { id: '#channel@irc.libera.chat', type: 'room' },
  object: { type: 'Note', content: 'Hello!' }
});
```

## Examples

### Example 1: Connect to IRC and join a channel

```javascript
// Set credentials
sc.socket.emit('credentials', {
  context: 'irc',
  type: 'credentials',
  actor: { id: 'mynick@irc.libera.chat' },
  object: {
    type: 'credentials',
    nick: 'mynick',
    server: 'irc.libera.chat',
    port: 6697,
    secure: true
  }
});

// Connect
sc.socket.emit('message', {
  context: 'irc',
  type: 'connect',
  actor: 'mynick@irc.libera.chat'
});

// Join channel
sc.socket.emit('message', {
  context: 'irc',
  type: 'join',
  actor: 'mynick@irc.libera.chat',
  target: { id: '#sockethub@irc.libera.chat', type: 'room' }
});
```

### Example 2: Send XMPP message

```javascript
// Set XMPP credentials
sc.socket.emit('credentials', {
  context: 'xmpp',
  type: 'credentials',
  actor: { id: 'user@jabber.org' },
  object: {
    type: 'credentials',
    userAddress: 'user@jabber.org',
    password: 'secret',
    resource: 'web'
  }
});

// Connect and send
sc.socket.emit('message', {
  context: 'xmpp',
  type: 'connect',
  actor: 'user@jabber.org'
});

sc.socket.emit('message', {
  context: 'xmpp',
  type: 'send',
  actor: 'user@jabber.org',
  target: { id: 'friend@jabber.org', type: 'person' },
  object: { type: 'Note', content: 'Hello from Sockethub!' }
});
```

### Example 3: Fetch RSS feed

```javascript
sc.socket.emit('message', {
  context: 'feeds',
  type: 'fetch',
  actor: { id: 'https://example.com/feed.rss' }
});

// Response is a Collection of Create activities with feed entries
sc.socket.on('message', (msg) => {
  if (msg.context === 'feeds') {
    msg.object.items.forEach(entry => {
      console.log(entry.object.title, entry.object.url);
    });
  }
});
```

## CLI Reference

```
sockethub [options]

Options:
  --port <number>      Server port (default: 10550, env: PORT)
  --host <string>      Server host (default: localhost, env: HOST)
  --config, -c <path>  Path to sockethub.config.json
  --examples           Enable example pages at /examples
  --info               Display runtime information
  --redis.url <url>    Redis connection URL (env: REDIS_URL)
  --sentry.dsn <dsn>   Sentry DSN for error reporting

Environment Variables:
  PORT        Server port
  HOST        Server hostname
  REDIS_URL   Redis connection string
  DEBUG       Debug namespaces (e.g., sockethub*)
```

## Supported Platforms

- IRC (`irc`): connect, join, leave, send, update, query, disconnect
- XMPP (`xmpp`): connect, join, leave, send, update, request-friend, make-friend,
  remove-friend, query, disconnect
- Feeds (`feeds`): fetch (RSS 2.0, Atom 1.0, RSS 1.0/RDF)
- Metadata (`metadata`): fetch (Open Graph and page metadata)

## ActivityStreams Message Format

All messages follow ActivityStreams 2.0 structure:

```javascript
{
  context: 'irc' | 'xmpp' | 'feeds', // Platform identifier
  type: 'send' | 'join' | 'connect', // Action type
  actor: { id: 'user@server', type: 'person' }, // Who is acting
  target: { id: 'room@server', type: 'room' }, // Target of action
  object: { type: 'Note', content: '...' } // Payload
}
```

If `actor` is provided as a string, Sockethub expands it using any previously
saved ActivityObject with the same id (including `type` and other stored
properties). If none exists, it expands to `{ id }`.

## API Reference

### SockethubClient

```javascript
import SockethubClient from '@sockethub/client';

const sc = new SockethubClient(socket);

// Properties
sc.socket           // Underlying Socket.IO instance
sc.ActivityStreams  // ActivityStreams helper library

// Methods
sc.clearCredentials()  // Remove stored credentials

// Events
sc.socket.on('message', handler)      // Incoming messages
sc.socket.on('completed', handler)    // Job completion
sc.socket.on('failed', handler)       // Job failure
sc.socket.emit('message', activity)   // Send message
sc.socket.emit('credentials', creds)  // Set credentials
```

### IRC Credentials

```javascript
{
  type: 'credentials',
  nick: 'nickname',
  server: 'irc.libera.chat',
  port: 6697,
  secure: true,
  password: 'optional',
  sasl: false
}
```

### XMPP Credentials

```javascript
{
  type: 'credentials',
  userAddress: 'user@domain',
  password: 'secret',
  resource: 'device-identifier'
}
```

## Requirements

- Bun >= 1.2.4 (or Node.js 18+)
- Redis server

## Related Packages

- `@sockethub/client` - Browser/Node client library
- `@sockethub/server` - Core server implementation
- `@sockethub/activity-streams` - ActivityStreams utilities
- `@sockethub/platform-irc` - IRC platform
- `@sockethub/platform-xmpp` - XMPP platform
- `@sockethub/platform-feeds` - RSS/Atom platform
