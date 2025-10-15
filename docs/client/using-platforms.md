# Using Platforms

This guide covers how to use each of Sockethub's built-in platforms, including setup,
configuration, and common usage patterns.

## Available Platforms

Sockethub includes several platforms for different protocols and services:

- **[Dummy](#dummy-platform)** - Testing and development platform
- **[IRC](#irc-platform)** - Internet Relay Chat
- **[XMPP](#xmpp-platform)** - Jabber/XMPP messaging
- **[Feeds](#feeds-platform)** - RSS/Atom feed processing
- **[Metadata](#metadata-platform)** - Web page metadata extraction

## Platform Basics

### Connection Pattern

Most platforms follow this basic pattern:

1. **Set credentials** (if required)
2. **Connect** to the service
3. **Perform actions** (send, join, fetch, etc.)
4. **Handle responses** and incoming events

```javascript
// 1. Set credentials
sc.socket.emit('credentials', {
    context: 'platform-name',
    actor: { '@id': 'user-id', '@type': 'person' },
    object: { /* credential object */ }
});

// 2. Connect
sc.socket.emit('message', {
    '@type': 'connect',
    context: 'platform-name',
    actor: { '@id': 'user-id', '@type': 'person' }
});

// 3. Handle connection success, then perform actions
sc.socket.on('completed', function(msg) {
    if (msg['@type'] === 'connect') {
        // Now connected, can perform actions
    }
});
```

## Dummy Platform

The dummy platform is used for testing and doesn't require credentials.

### Available Actions

- `echo` - Returns the message unchanged
- `greet` - Returns a greeting message
- `fail` - Intentionally fails for testing error handling
- `throw` - Throws an exception for testing

### Example Usage

```javascript
// Echo test
sc.socket.emit('message', {
    '@type': 'echo',
    context: 'dummy',
    actor: { '@id': 'test-user', '@type': 'person' },
    object: {
        '@type': 'note',
        content: 'Hello World!'
    }
});

// Greeting
sc.socket.emit('message', {
    '@type': 'greet',
    context: 'dummy',
    actor: { '@id': 'test-user', '@type': 'person' }
});
```

**See also**: [Dummy Platform Documentation](../../packages/platform-dummy/README.md)

## IRC Platform

Connect to IRC servers and participate in channels.

### IRC Credentials

```javascript
{
    '@type': 'credentials',
    server: 'irc.libera.chat',    // IRC server hostname
    nick: 'mynick',               // Your nickname
    password: 'server-password',  // Optional server password
    port: 6667,                   // Optional port (default: 6667)
    secure: false                 // Optional SSL/TLS (default: false)
}
```

### IRC Actions

#### Connect to IRC Server

```javascript
sc.socket.emit('message', {
    '@type': 'connect',
    context: 'irc',
    actor: { '@id': 'mynick', '@type': 'person' }
});
```

#### Join Channel

```javascript
sc.socket.emit('message', {
    '@type': 'join',
    context: 'irc',
    actor: { '@id': 'mynick', '@type': 'person' },
    target: { '@id': '#javascript', '@type': 'room' }
});
```

#### Send Channel Message

```javascript
sc.socket.emit('message', {
    '@type': 'send',
    context: 'irc',
    actor: { '@id': 'mynick', '@type': 'person' },
    target: { '@id': '#javascript', '@type': 'room' },
    object: {
        '@type': 'note',
        content: 'Hello everyone!'
    }
});
```

#### Send Private Message

```javascript
sc.socket.emit('message', {
    '@type': 'send',
    context: 'irc',
    actor: { '@id': 'mynick', '@type': 'person' },
    target: { '@id': 'friendnick', '@type': 'person' },
    object: {
        '@type': 'note',
        content: 'Hi there!'
    }
});
```

#### Leave Channel

```javascript
sc.socket.emit('message', {
    '@type': 'leave',
    context: 'irc',
    actor: { '@id': 'mynick', '@type': 'person' },
    target: { '@id': '#javascript', '@type': 'room' }
});
```

### IRC Incoming Events

Listen for incoming IRC messages:

```javascript
sc.socket.on('message', function(msg) {
    if (msg.context === 'irc') {
        switch(msg['@type']) {
            case 'send':
                console.log(`IRC message from ${msg.actor['@id']}: ${msg.object.content}`);
                break;
            case 'join':
                console.log(`${msg.actor['@id']} joined ${msg.target['@id']}`);
                break;
            case 'leave':
                console.log(`${msg.actor['@id']} left ${msg.target['@id']}`);
                break;
        }
    }
});
```

**See also**: [IRC Platform Documentation](../../packages/platform-irc/README.md)

## XMPP Platform

Connect to XMPP (Jabber) servers for instant messaging and presence.

### XMPP Credentials

```javascript
{
    '@type': 'credentials',
    server: 'jabber.org',        // XMPP server
    username: 'myuser',          // Username (without @domain)
    password: 'mypassword',      // Password
    resource: 'webapp'           // Optional resource identifier
}
```

### XMPP Actions

#### Connect to XMPP Server

```javascript
sc.socket.emit('message', {
    '@type': 'connect',
    context: 'xmpp',
    actor: { '@id': 'user@jabber.org', '@type': 'person' }
});
```

#### Send Message

```javascript
sc.socket.emit('message', {
    '@type': 'send',
    context: 'xmpp',
    actor: { '@id': 'user@jabber.org', '@type': 'person' },
    target: { '@id': 'friend@jabber.org', '@type': 'person' },
    object: {
        '@type': 'note',
        content: 'Hello from XMPP!'
    }
});
```

#### Join Chat Room (MUC)

```javascript
sc.socket.emit('message', {
    '@type': 'join',
    context: 'xmpp',
    actor: { '@id': 'user@jabber.org', '@type': 'person' },
    target: { '@id': 'room@conference.jabber.org', '@type': 'room' }
});
```

#### Update Presence

```javascript
sc.socket.emit('message', {
    '@type': 'update',
    context: 'xmpp',
    actor: { '@id': 'user@jabber.org', '@type': 'person' },
    object: {
        '@type': 'presence',
        presence: 'away',
        content: 'Gone for lunch'
    }
});
```

#### Request Friend

```javascript
sc.socket.emit('message', {
    '@type': 'request-friend',
    context: 'xmpp',
    actor: { '@id': 'user@jabber.org', '@type': 'person' },
    target: { '@id': 'friend@jabber.org', '@type': 'person' }
});
```

### XMPP Incoming Events

```javascript
sc.socket.on('message', function(msg) {
    if (msg.context === 'xmpp') {
        switch(msg['@type']) {
            case 'send':
                console.log(`XMPP message from ${msg.actor['@id']}: ${msg.object.content}`);
                break;
            case 'update':
                if (msg.object['@type'] === 'presence') {
                    console.log(`${msg.actor['@id']} is now ${msg.object.presence}`);
                }
                break;
            case 'request-friend':
                console.log(`Friend request from ${msg.actor['@id']}`);
                break;
        }
    }
});
```

**See also**: [XMPP Platform Documentation](../../packages/platform-xmpp/README.md)

## Feeds Platform

Fetch and parse RSS/Atom feeds. No credentials required.

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

### Feeds Response Format

The platform returns a collection of feed entries:

```javascript
sc.socket.on('completed', function(msg) {
    if (msg.context === 'feeds' && msg['@type'] === 'fetch') {
        console.log(`Feed has ${msg.object.totalItems} items`);
        msg.object.items.forEach(item => {
            console.log(`- ${item.object.name}: ${item.object.url}`);
        });
    }
});
```

### Supported Formats

- RSS 2.0
- Atom 1.0
- RSS 1.0/RDF

**See also**: [Feeds Platform Documentation](../../packages/platform-feeds/README.md)

## Metadata Platform

Extract metadata from web pages using Open Graph and other structured data. No credentials required.

### Extract Page Metadata

```javascript
sc.socket.emit('message', {
    '@type': 'fetch',
    context: 'metadata',
    actor: { '@id': 'metadata-service', '@type': 'service' },
    object: {
        '@type': 'link',
        url: 'https://example.com/article'
    }
});
```

### Response Format

```javascript
sc.socket.on('completed', function(msg) {
    if (msg.context === 'metadata') {
        const data = msg.object;
        console.log(`Title: ${data.title}`);
        console.log(`Description: ${data.description}`);
        console.log(`Image: ${data.image?.[0]?.url}`);
        console.log(`Site: ${data.name}`);
    }
});
```

### Extracted Data

The platform extracts:

- Open Graph data (title, description, images)
- Site information (favicon, charset)
- Canonical URLs
- Media with dimensions and type

**See also**: [Metadata Platform Documentation](../../packages/platform-metadata/README.md)

## Error Handling

All platforms use consistent error handling:

```javascript
sc.socket.on('failure', function(err) {
    console.error(`Platform ${err.context} error:`, err.message);
    
    // Handle specific platform errors
    switch(err.context) {
        case 'irc':
            if (err.message.includes('nick already in use')) {
                // Handle nick collision
            }
            break;
        case 'xmpp':
            if (err.message.includes('authentication failed')) {
                // Handle auth failure
            }
            break;
        case 'feeds':
            if (err.message.includes('invalid feed')) {
                // Handle feed parsing error
            }
            break;
    }
});
```

## Best Practices

### Connection Management

```javascript
// Track connection state
const connections = {
    irc: false,
    xmpp: false
};

sc.socket.on('completed', function(msg) {
    if (msg['@type'] === 'connect') {
        connections[msg.context] = true;
        console.log(`Connected to ${msg.context}`);
    }
});

// Only send messages after connection
function sendMessage(context, message) {
    if (!connections[context]) {
        console.error(`Not connected to ${context}`);
        return;
    }
    sc.socket.emit('message', message);
}
```

### Resource Cleanup

```javascript
// Disconnect when page unloads
window.addEventListener('beforeunload', function() {
    ['irc', 'xmpp'].forEach(context => {
        if (connections[context]) {
            sc.socket.emit('message', {
                '@type': 'disconnect',
                context: context,
                actor: { '@id': 'user-id', '@type': 'person' }
            });
        }
    });
});
```

### Credential Security

- Never log or expose credentials in client-side code
- Use environment variables for server-side credential storage
- Implement proper authentication flows for production apps

## Platform-Specific Configuration

Some platforms support additional configuration options in the Sockethub server config:

```json
{
    "platforms": {
        "irc": {
            "enabled": true,
            "timeout": 30000,
            "retries": 3
        },
        "xmpp": {
            "enabled": true,
            "features": {
                "muc": true,
                "presence": true
            }
        }
    }
}
```

See [Configuration Guide](../getting-started/configuration.md) for full details.

## Next Steps

- **[ActivityStreams Guide](activitystreams.md)** - Understanding message formats
- **[Client Library](README.md)** - Complete client API reference
- **[Creating Platforms](../platform-development/creating-platforms.md)** - Build custom platforms
