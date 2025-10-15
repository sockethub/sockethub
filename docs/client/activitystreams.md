# ActivityStreams in Sockethub

ActivityStreams 2.0 is the message format used for all communication with Sockethub.
This guide explains how to construct and use ActivityStreams objects effectively.

## Basic Structure

Every ActivityStreams message has this basic structure:

```json
{
  "@type": "verb",      // The action to perform
  "context": "platform", // Which platform to use
  "actor": {...},       // Who is performing the action
  "target": {...},      // Where/who to send to (optional)
  "object": {...}       // What is being sent/acted upon
}
```

## Core Properties

### @type (Verb)

The action to be performed. Common verbs:

- `connect` - Establish connection to a service
- `send` - Send a message or data
- `fetch` - Retrieve information
- `join` - Join a room/channel
- `leave` - Leave a room/channel
- `update` - Update status or information
- `observe` - Subscribe to events/presence

### context

Specifies which platform should handle the message:

- `dummy` - Test platform
- `irc` - IRC protocol
- `xmpp` - XMPP/Jabber protocol
- `feeds` - RSS/Atom feeds
- `metadata` - Web page metadata extraction

### actor

Represents the user or entity performing the action:

```json
{
  "@id": "user@example.com",    // Unique identifier
  "@type": "person",            // Type of entity
  "displayName": "John Doe",    // Human-readable name
  "name": "John Doe",           // Canonical name
  "url": "http://johndoe.com"   // Optional URL
}
```

### target

Represents the destination or recipient:

```json
{
  "@id": "friend@example.com",  // For direct messages
  "@type": "person"
}

{
  "@id": "#channel",            // For IRC channels
  "@type": "room"
}

{
  "@id": "room@conference.example.com", // For XMPP rooms
  "@type": "room"
}
```

### object

Contains the data being sent or acted upon:

```json
{
  "@type": "note",              // Type of content
  "content": "Hello, world!",   // Message content
  "published": "2023-01-01T12:00:00Z" // Timestamp
}
```

## Platform-Specific Examples

### IRC Messages

**Join Channel:**

```json
{
  "@type": "join",
  "context": "irc",
  "actor": {
    "@id": "mynick",
    "@type": "person"
  },
  "target": {
    "@id": "#javascript",
    "@type": "room"
  }
}
```

**Send Channel Message:**

```json
{
  "@type": "send",
  "context": "irc",
  "actor": {
    "@id": "mynick",
    "@type": "person"
  },
  "target": {
    "@id": "#javascript",
    "@type": "room"
  },
  "object": {
    "@type": "note",
    "content": "Hello everyone!"
  }
}
```

**Private Message:**

```json
{
  "@type": "send",
  "context": "irc",
  "actor": {
    "@id": "mynick",
    "@type": "person"
  },
  "target": {
    "@id": "friendnick",
    "@type": "person"
  },
  "object": {
    "@type": "note",
    "content": "Hi there!"
  }
}
```

### XMPP Messages

**Connect:**

```json
{
  "@type": "connect",
  "context": "xmpp",
  "actor": {
    "@id": "user@jabber.org",
    "@type": "person"
  }
}
```

**Send Message:**

```json
{
  "@type": "send",
  "context": "xmpp",
  "actor": {
    "@id": "user@jabber.org",
    "@type": "person"
  },
  "target": {
    "@id": "friend@jabber.org",
    "@type": "person"
  },
  "object": {
    "@type": "note",
    "content": "Hello from XMPP!"
  }
}
```

**Update Presence:**

```json
{
  "@type": "update",
  "context": "xmpp",
  "actor": {
    "@id": "user@jabber.org",
    "@type": "person"
  },
  "object": {
    "@type": "presence",
    "presence": "away",
    "content": "Gone for lunch"
  }
}
```

### Feeds

**Fetch Feed:**

```json
{
  "@type": "fetch",
  "context": "feeds",
  "actor": {
    "@id": "feed-reader",
    "@type": "service"
  },
  "object": {
    "@type": "feed",
    "url": "https://example.com/rss.xml"
  }
}
```

### Metadata Extraction

**Get Page Metadata:**

```json
{
  "@type": "fetch",
  "context": "metadata",
  "actor": {
    "@id": "metadata-service",
    "@type": "service"
  },
  "object": {
    "@type": "link",
    "url": "https://example.com/article"
  }
}
```

## Response Messages

Sockethub responds with ActivityStreams messages as well:

### Success Response

```json
{
  "@type": "send",
  "context": "irc",
  "actor": {
    "@id": "mynick",
    "@type": "person"
  },
  "target": {
    "@id": "#channel",
    "@type": "room"
  },
  "object": {
    "@type": "note",
    "content": "Message sent successfully"
  }
}
```

### Incoming Message

```json
{
  "@type": "message",
  "context": "irc",
  "actor": {
    "@id": "othernick",
    "@type": "person"
  },
  "target": {
    "@id": "mynick",
    "@type": "person"
  },
  "object": {
    "@type": "note",
    "content": "Hello there!",
    "published": "2023-01-01T12:30:00Z"
  }
}
```

### Error Response

```json
{
  "@type": "failure",
  "context": "irc",
  "actor": {
    "@id": "system",
    "@type": "service"
  },
  "object": {
    "@type": "error",
    "content": "Connection failed: Invalid credentials"
  }
}
```

## Advanced Features

### Message Threading

For platforms that support it, you can reference previous messages:

```json
{
  "@type": "send",
  "context": "xmpp",
  "actor": {...},
  "target": {...},
  "object": {
    "@type": "note",
    "content": "This is a reply",
    "inReplyTo": {
      "@id": "previous-message-id",
      "@type": "note"
    }
  }
}
```

### Rich Content

Some platforms support rich content:

```json
{
  "@type": "send",
  "context": "xmpp",
  "actor": {...},
  "target": {...},
  "object": {
    "@type": "note",
    "content": "Check out this link",
    "attachment": [{
      "@type": "link",
      "url": "https://example.com",
      "name": "Example Site",
      "mediaType": "text/html"
    }]
  }
}
```

### Custom Properties

Platforms can extend objects with custom properties:

```json
{
  "@type": "send",
  "context": "irc",
  "actor": {...},
  "target": {...},
  "object": {
    "@type": "note",
    "content": "Action message",
    "irc:action": true  // IRC-specific property
  }
}
```

## Validation

All messages are validated against JSON schemas. Common validation errors:

- **Missing required properties**: `@type`, `context`, `actor`
- **Invalid types**: Using wrong `@type` for context
- **Malformed IDs**: Invalid format for `@id` properties
- **Unknown properties**: Platform doesn't support certain properties

## Best Practices

### Naming Conventions

- Use lowercase for verbs: `send`, `join`, `leave`
- Use descriptive IDs: `user@domain.com`, `#channel-name`
- Include timestamps for events: `published`, `updated`

### Error Handling

Always handle both `completed` and `failure` events:

```javascript
sc.socket.on('completed', function(msg) {
  // Handle successful response
});

sc.socket.on('failure', function(err) {
  // Handle error response
});
```

### Resource Management

Clean up connections when done:

```json
{
  "@type": "disconnect",
  "context": "xmpp",
  "actor": {
    "@id": "user@jabber.org",
    "@type": "person"
  }
}
```

## Schema Reference

For complete schema definitions, see:

- [Platform schemas](../../packages/platform-*/src/schema.js)
- [Core schemas](../../packages/schemas/)
- [ActivityStreams 2.0 specification](https://www.w3.org/TR/activitystreams-core/)

## Next Steps

- **[Client Library](README.md)** - Using the Sockethub client
- **[Platform Usage](using-platforms.md)** - Platform-specific guides
- **[Creating Platforms](../platform-development/creating-platforms.md)** - Build custom platforms
