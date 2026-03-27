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
const sc = new SockethubClient(socket, { initTimeoutMs: 5000 });

// Listen for messages
sc.socket.on('message', (msg) => console.log(msg));

// Wait for schema registry before using contextFor()
await sc.ready();

// Send ActivityStreams message
sc.socket.emit('message', {
  '@context': sc.contextFor('irc'),
  type: 'send',
  actor: { id: 'myuser@irc.libera.chat', type: 'person' },
  target: { id: '#channel@irc.libera.chat', type: 'room' },
  object: { type: 'message', content: 'Hello!' }
});
```

## Examples

### Example 1: Connect to IRC and join a channel

```javascript
// Set credentials
sc.socket.emit('credentials', {
  '@context': sc.contextFor('irc'),
  type: 'credentials',
  actor: { id: 'mynick@irc.libera.chat', type: 'person' },
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
  '@context': sc.contextFor('irc'),
  type: 'connect',
  actor: { id: 'mynick@irc.libera.chat', type: 'person' }
});

// Join channel
sc.socket.emit('message', {
  '@context': sc.contextFor('irc'),
  type: 'join',
  actor: { id: 'mynick@irc.libera.chat', type: 'person' },
  target: { id: '#sockethub@irc.libera.chat', type: 'room' }
});
```

### Example 2: Send XMPP message

```javascript
// Set XMPP credentials
sc.socket.emit('credentials', {
  '@context': sc.contextFor('xmpp'),
  type: 'credentials',
  actor: { id: 'user@jabber.org', type: 'person' },
  object: {
    type: 'credentials',
    userAddress: 'user@jabber.org',
    password: 'secret',
    resource: 'web'
  }
});

// Connect and send
sc.socket.emit('message', {
  '@context': sc.contextFor('xmpp'),
  type: 'connect',
  actor: { id: 'user@jabber.org', type: 'person' }
});

sc.socket.emit('message', {
  '@context': sc.contextFor('xmpp'),
  type: 'send',
  actor: { id: 'user@jabber.org', type: 'person' },
  target: { id: 'friend@jabber.org', type: 'person' },
  object: { type: 'message', content: 'Hello from Sockethub!' }
});
```

### Example 3: Fetch RSS feed

```javascript
sc.socket.emit('message', {
  '@context': sc.contextFor('feeds'),
  type: 'fetch',
  actor: { id: 'https://example.com/feed.rss', type: 'feed' }
}, (response) => {
  // Response is an ASCollection with feed entries
  if (response.items) {
    response.items.forEach(entry => {
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
  "@context": [                        // Platform context array
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/{platform}/v1.jsonld"
  ],
  type: 'send' | 'join' | 'connect', // Action type
  actor: { id: 'user@server', type: 'person' }, // Who is acting
  target: { id: 'room@server', type: 'room' }, // Target of action
  object: { type: 'message', content: '...' } // Payload
}
```

If `actor` is provided as a string, Sockethub expands it using any previously
saved ActivityObject with the same id (including `type` and any other stored
properties). If none exists, it expands to `{ id }`.

## API Reference

### SockethubClient

```javascript
import SockethubClient from '@sockethub/client';

const sc = new SockethubClient(socket, { initTimeoutMs: 5000 });

// Properties
sc.socket           // Public event emitter wrapping the Socket.IO client
sc.ActivityStreams  // ActivityStreams helper library

// Methods
await sc.ready()            // Wait for schema registry initialization
sc.contextFor('irc')        // Build canonical @context array for a platform
sc.isReady()                // Check whether client is initialized
sc.getInitState()           // Return init state string
sc.clearCredentials()       // Remove stored credentials

// Events
sc.socket.on('message', handler)      // Incoming messages
sc.socket.on('ready', handler)        // Initialization complete
sc.socket.on('init_error', handler)   // Initialization issue
sc.socket.emit('message', activity)   // Send message (queued until ready)
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
