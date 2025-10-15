# Sockethub Client Library

The Sockethub client library provides a JavaScript interface for web applications to
communicate with the Sockethub server using ActivityStreams messages.

## Installation

### Include from Sockethub Server

The client library is served directly from your Sockethub server:

```html
<script src="http://your-sockethub-server:10550/socket.io.js"></script>
<script src="http://your-sockethub-server:10550/sockethub-client.js"></script>
```

### Using npm Package

```bash
npm install @sockethub/client
```

```javascript
import { SockethubClient } from '@sockethub/client';
import { io } from 'socket.io-client';
```

## Basic Usage

### 1. Connect to Sockethub

```javascript
// Create Socket.IO connection
const socket = io('http://localhost:10550', {
    path: '/sockethub'
});

// Create Sockethub client
const sc = new SockethubClient(socket);
```

### 2. Handle Events

```javascript
// Listen for successful completions
sc.socket.on('completed', function(msg) {
    console.log('Action completed:', msg);
});

// Listen for failures
sc.socket.on('failure', function(err) {
    console.error('Action failed:', err);
});

// Listen for incoming messages
sc.socket.on('message', function(msg) {
    console.log('Received message:', msg);
});
```

### 3. Send Messages

```javascript
// Send ActivityStreams message
sc.socket.emit('message', {
    '@type': 'connect',
    context: 'dummy',
    actor: {
        '@id': 'myuser@example.com',
        '@type': 'person',
        displayName: 'My User'
    }
});
```

## Working with Credentials

Many platforms require authentication credentials. These are sent separately from
messages and are encrypted by Sockethub.

### Setting Credentials

```javascript
sc.socket.emit('credentials', {
    context: 'xmpp',
    actor: {
        '@id': 'user@jabber.org',
        '@type': 'person'
    },
    object: {
        '@type': 'credentials',
        server: 'jabber.org',
        username: 'user',
        password: 'secret123',
        resource: 'webapp'
    }
});
```

### Platform-Specific Credentials

Each platform has different credential requirements:

**XMPP:**

```javascript
{
    '@type': 'credentials',
    server: 'jabber.org',
    username: 'myuser',
    password: 'mypassword',
    resource: 'home'  // optional
}
```

**IRC:**

```javascript
{
    '@type': 'credentials',
    server: 'irc.freenode.net',
    nick: 'mynick',
    password: 'optional-server-password',  // optional
    port: 6667  // optional, defaults to 6667
}
```

**Feeds:** (No credentials required)

## Creating ActivityStreams Objects

### Actor Objects

```javascript
const actor = sc.ActivityStreams.Object.create({
    '@id': 'user@example.com',
    '@type': 'person',
    displayName: 'John Doe',
    name: 'John Doe',
    url: 'http://johndoe.example.com'
});
```

### Message Objects

```javascript
const message = {
    '@type': 'note',
    content: 'Hello, world!',
    published: new Date().toISOString()
};
```

## Common Patterns

### Connect and Send Message

```javascript
// 1. Set credentials (if required)
sc.socket.emit('credentials', {
    context: 'xmpp',
    actor: { '@id': 'user@jabber.org', '@type': 'person' },
    object: {
        '@type': 'credentials',
        server: 'jabber.org',
        username: 'user',
        password: 'password'
    }
});

// 2. Connect to platform
sc.socket.emit('message', {
    '@type': 'connect',
    context: 'xmpp',
    actor: { '@id': 'user@jabber.org', '@type': 'person' }
});

// 3. Wait for connection, then send message
sc.socket.on('completed', function(msg) {
    if (msg['@type'] === 'connect') {
        // Connection successful, send message
        sc.socket.emit('message', {
            '@type': 'send',
            context: 'xmpp',
            actor: { '@id': 'user@jabber.org', '@type': 'person' },
            target: { '@id': 'friend@jabber.org', '@type': 'person' },
            object: {
                '@type': 'note',
                content: 'Hello from Sockethub!'
            }
        });
    }
});
```

### Join Chat Room

```javascript
// Join IRC channel
sc.socket.emit('message', {
    '@type': 'join',
    context: 'irc',
    actor: { '@id': 'mynick', '@type': 'person' },
    target: { '@id': '#mychannel', '@type': 'room' }
});

// Join XMPP room
sc.socket.emit('message', {
    '@type': 'join',
    context: 'xmpp',
    actor: { '@id': 'user@jabber.org', '@type': 'person' },
    target: { '@id': 'room@conference.jabber.org', '@type': 'room' }
});
```

### Fetch Feed

```javascript
sc.socket.emit('message', {
    '@type': 'fetch',
    context: 'feeds',
    actor: { '@id': 'feed-reader', '@type': 'service' },
    object: {
        '@type': 'feed',
        url: 'https://feeds.feedburner.com/oreilly/radar'
    }
});
```

## Error Handling

### Handling Failures

```javascript
sc.socket.on('failure', function(err) {
    console.error('Error:', err.message);
    
    // Handle specific error types
    switch(err.message) {
        case 'invalid credentials':
            // Prompt user for correct credentials
            break;
        case 'connection failed':
            // Show connection error
            break;
        case 'platform not found':
            // Platform not available
            break;
        default:
            // Generic error handling
            break;
    }
});
```

### Timeout Handling

```javascript
let timeoutId;

// Set timeout for responses
function sendWithTimeout(message, timeoutMs = 10000) {
    timeoutId = setTimeout(() => {
        console.error('Request timed out');
    }, timeoutMs);
    
    sc.socket.emit('message', message);
}

// Clear timeout on response
sc.socket.on('completed', function(msg) {
    clearTimeout(timeoutId);
    // Handle response
});

sc.socket.on('failure', function(err) {
    clearTimeout(timeoutId);
    // Handle error
});
```

## Advanced Usage

### Custom Event Handling

```javascript
// Handle platform-specific events
sc.socket.on('message', function(msg) {
    if (msg.context === 'irc' && msg['@type'] === 'join') {
        console.log('Someone joined IRC channel:', msg.actor.displayName);
    }
    
    if (msg.context === 'xmpp' && msg['@type'] === 'update') {
        console.log('XMPP presence update:', msg.actor['@id'], msg.object.presence);
    }
});
```

### Multiple Platform Connections

```javascript
// Connect to multiple platforms simultaneously
const platforms = ['irc', 'xmpp', 'feeds'];

platforms.forEach(platform => {
    sc.socket.emit('message', {
        '@type': 'connect',
        context: platform,
        actor: { '@id': 'multi-user', '@type': 'person' }
    });
});
```

## Next Steps

- **[ActivityStreams Guide](activitystreams.md)** - Understanding the message format
- **[Using Platforms](using-platforms.md)** - Platform-specific documentation
- **[Examples](../../packages/examples/)** - Interactive examples and demos
