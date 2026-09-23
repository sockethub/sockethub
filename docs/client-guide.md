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
  console.log('Sockethub ready:', info.reason, `API v${info.apiVersion}`,
    info.platforms.map((p) => ({ id: p.id, apiVersion: p.apiVersion })));
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
    actor: { id: 'mynick@irc.libera.chat', type: 'person', name: 'mynick' },
    target: { id: '#sockethub@irc.libera.chat', type: 'room', name: '#sockethub' },
    object: { type: 'message', content: 'Hello channel' }
}, (result) => {
    if (result?.error) {
        console.error('Send failed:', result.error);
        return;
    }

    console.log('Send succeeded:', result);
});
```

This same pattern applies to `credentials` events.

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
  "actor": { "id": "user@irc.libera.chat", "type": "person", "name": "user" },  // Who
  "target": { "id": "#room@irc.libera.chat", "type": "room", "name": "#room" },  // Where (optional)
  "object": { "type": "message", "content": "Hi!" }   // What
}
```

The `actor` object must have an `id` and `type` field, and if `name` does not exist,
the `id` will be used for display purposes.

For IRC, room targets use `#channel@server` in `target.id` (for example
`#sockethub@irc.libera.chat`). Put the channel name as it appears on IRC in
`target.name` (for example `#sockethub`). Keeping the channel sigil in
`target.id` preserves the IRC channel name and distinguishes room ids from
person ids (`nick@server`); additional sigils are preserved as well (for
example `##private@irc.libera.chat`).

### Platform-Specific Object Properties

The standard ActivityStreams fields cover common concepts like content and type,
but real protocols have richer ideas — threading, read receipts, delivery
options, and more. You can put those extra fields directly into the `object`
you're sending, and Sockethub passes them through to the platform without
rejecting them.

Once `ready()` resolves, the client knows what each platform accepts:

```javascript
await sc.ready();

sc.socket.emit('message', {
    type: 'send',
    '@context': sc.contextFor('irc'),
    actor: { id: 'me@irc.libera.chat', type: 'person', name: 'me' },
    target: { id: '#general@irc.libera.chat', type: 'room', name: '#general' },
    object: {
        type: 'message',
        content: 'Hello!',
        replyTo: 'msg-42'   // platform-specific field
    }
});
```

### Platforms Requiring Credentials

```javascript
await sc.ready();

// 1. Send credentials
sc.socket.emit('credentials', {
    '@context': sc.contextFor('irc'),
    type: 'credentials',
    actor: { id: 'mynick@irc.libera.chat', type: 'person', name: 'mynick' },
    object: {
        type: 'credentials',
        nick: 'mynick',
        server: 'irc.libera.chat',
        secure: true
        // password: 'secret'              // SASL PLAIN (traditional password)
        // token: 'my-access-token',      // SASL PLAIN with token (e.g. Libera PAT)
        // token: 'oauth-access-token',   // or for OAUTHBEARER (requires saslMechanism below)
        // saslMechanism: 'OAUTHBEARER'   // required for OAuth 2.0 bearer tokens (RFC 7628)
    }
});

// 2. Connect
sc.socket.emit('message', {
    type: 'connect',
    '@context': sc.contextFor('irc'),
    actor: { id: 'mynick@irc.libera.chat', type: 'person', name: 'mynick' }
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
password, they do not share one running IRC session. Each gets its own
connection, and IRC decides what happens next — the second one normally fails
because the nick is already taken:

```json
{
  "context": "irc",
  "type": "connect",
  "actor": { "id": "mynick@irc.libera.chat", "type": "person", "name": "mynick" },
  "id": "1",
  "error": "unable to connect to server: nicknames unavailable"
}
```

The error comes from IRC rather than from Sockethub. Earlier versions rejected
this with `unable to attach session for this actor`; that message no longer
exists, because it also revealed whether someone else was connected as that
actor.

Client apps should treat any callback payload containing `error` as a failed
action and reset UI state accordingly (for example, re-enable a connect button).

Small exception: after a browser refresh, a reconnect from the same client IP
lands back on the original connection while the old stale socket is waiting for
janitor cleanup.

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
    actor: { id: 'https://example.com/feed.xml', type: 'feed' },
    // optional filters: entries published at/after `since`, at most `limit`
    object: { since: '2024-01-01T00:00:00.000Z', limit: 10 }
});
```

### IRC (Chat)

```javascript
// Join channel
sc.socket.emit('message', {
    type: 'join',
    '@context': sc.contextFor('irc'),
    actor: { id: 'mynick@irc.libera.chat', type: 'person', name: 'mynick' },
    target: { id: '#channel@irc.libera.chat', type: 'room', name: '#channel' }
});
```

## Client Features

- **Schema-driven init**: `ready()` resolves when the server's schema registry is loaded
- **API versions, not package versions**: the bootstrap reports `apiVersion` for
  Sockethub and for each platform — the SemVer major of the corresponding
  package. Use these for compatibility checks; exact package versions are not
  published to clients
- **Registry caching**: the registry is fetched once and cached; on reconnect the
  client echoes a fingerprint so the server skips re-sending an unchanged registry
- **Context composition**: `contextFor(platform)` builds canonical `@context` arrays
- **Outbound queueing**: Messages sent before `ready()` are queued and flushed automatically
- **Auto-replay**: Credentials and connections restored on reconnect
- **ActivityStream handling**: outbound messages are normalized and validated against
  the platform's schema (via `@sockethub/schemas`) before sending; incoming messages
  are normalized before delivery
- **Connection state**: Check `sc.socket.connected` for status

## HTTP Actions (no WebSocket)

For one-shot work such as fetching a feed, extracting page metadata, or a
CalDAV query, a client can skip the WebSocket and `POST` ActivityStreams
messages over plain HTTP. The messages go through the same validation,
credential handling, and platform pipeline as the Socket.IO transport. Only
the transport differs: a request carries a batch of messages, and the response
streams one result per message as NDJSON (newline-delimited JSON).

HTTP actions are off by default; the operator enables them with
`httpActions.enabled` (see [Configuration](configuration.md#http-actions)).
The server info page at the root URL shows the endpoint when it is on, and a
`GET` with no request ID returns the service descriptor so a client can check
for it programmatically:

```js
const res = await fetch('http://localhost:10550/sockethub-http');
if (res.ok) {
    const { apiVersion, platforms } = await res.json();
    // platforms: [{ id: 'feeds', apiVersion: 4 }, ...]
}
```

### Sending a request

`POST` a JSON array of messages (a single object also works) with a request ID
that is unique and unguessable, such as a UUID. The ID can travel in the
`X-Request-Id` header, the `X-Sockethub-Request-Id` header, or a `requestId`
field in the body. Anyone who knows the ID can replay the results until they
expire, so treat it like a secret.

```js
const requestId = crypto.randomUUID();
const res = await fetch('http://localhost:10550/sockethub-http', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
    },
    body: JSON.stringify([
        {
            '@context': [
                'https://www.w3.org/ns/activitystreams',
                'https://sockethub.org/ns/context/v1.jsonld',
                'https://sockethub.org/ns/context/platform/feeds/v1.jsonld',
            ],
            type: 'fetch',
            actor: { id: 'https://example.com/feed.xml', type: 'feed' },
        },
    ]),
});
```

Messages that need credentials send them the same way as over Socket.IO: put a
`credentials` message first in the array, then the messages that use them. The
response acknowledges the credentials with a minimal `credentials-ack`; the
credential object itself is never echoed back or cached.

### Reading the response

The body is `application/x-ndjson`, one complete JSON object per line, streamed
as results arrive. Read it incrementally rather than waiting for the whole
body:

```js
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffered = '';
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split('\n');
    buffered = lines.pop();
    for (const line of lines) {
        if (line.trim()) handle(JSON.parse(line));
    }
}
```

Each line is an ActivityStreams object. Errors arrive as a line with
`type: 'error'` and an `error` string rather than as an HTTP error status, so
a `200` means the request was accepted, not that every message succeeded.

### Replaying results

Results are cached under the request ID for the operator's `idempotencyTtlMs`
(five minutes by default). If the connection drops mid-stream, fetch them again
by path or query string:

```bash
curl -N http://localhost:10550/sockethub-http/<requestId>
curl -N "http://localhost:10550/sockethub-http?requestId=<requestId>"
```

Repeating the original `POST` with the same ID replays the cached results too.
If the request is still running you get `409` instead.

### Limits and CORS

The operator controls the maximum messages per request, payload size, total
request timeout, and idle timeout between streamed lines. Browser apps on a
different origin need that origin allowed in `sockethub.cors.origin`, the same
setting that governs Socket.IO connections. Details and defaults are in
[Configuration](configuration.md#http-actions).

## Reference

- **[Client Package](../packages/client/)** - Full API documentation
- **[Schemas Package](../packages/schemas/)** - Activity stream validation, normalization, and JSON schemas
- **[HTTP Actions configuration](configuration.md#http-actions)** - Operator settings,
  request/response reference, API discovery
- **[ActivityStreams Spec](https://www.w3.org/TR/activitystreams-core/)** - Message format specification
