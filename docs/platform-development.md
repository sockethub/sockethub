# Platform Development

Creating custom platforms to add new protocols to Sockethub.

## What is a Platform?

A platform is a Node.js package that acts as a bridge between Sockethub and external services. When a web application sends an ActivityStreams message to Sockethub, the platform translates it into the specific protocol's format and handles the communication.

For example: A web app sends `{ type: "send", context: "irc", object: { content: "hello" } }` → the IRC platform converts this to an IRC `PRIVMSG #channel :hello` command and sends it to the IRC server.

## Quick Start

### 1. Create Package Structure

```
@sockethub/platform-myprotocol/
├── package.json
├── src/
│   ├── index.ts
│   └── schema.ts
└── README.md
```

### 2. Basic Platform

```typescript
import type {
    ActivityStream,
    PlatformCallback,
    PlatformInterface,
    PlatformSession,
} from "@sockethub/schemas";

export default class MyProtocol implements PlatformInterface {
    debug;
    config = { persist: false };

    constructor(session: PlatformSession) {
        this.debug = session.debug;
    }

    get schema() {
        return {
            name: "myprotocol",
            version: "1.0.0",
            messages: {
                properties: {
                    type: { enum: ["fetch"] }
                }
            }
        };
    }

    fetch(job: ActivityStream, cb: PlatformCallback) {
        // Your protocol logic here
        this.debug('Fetching:', job.actor.id);
        cb(undefined, job);
    }

    cleanup(cb: PlatformCallback) {
        cb();
    }
}
```

### 3. Add to Sockethub

In your `sockethub.config.json`:

```json
{
  "platforms": [
    "@sockethub/platform-myprotocol"
  ]
}
```

## Platform Types

### Stateless Platforms

Don't maintain connections. Good for HTTP APIs or one-time operations like RSS feeds.

```typescript
config = { persist: false };

// Methods get called fresh each time
fetch(job: ActivityStream, cb: PlatformCallback) {
    // No connection state to maintain
}
```

### Persistent Platforms

Maintain connections and require authentication. Good for chat protocols like IRC or XMPP.

```typescript
config = {
    persist: true,
    requireCredentials: ["connect"],
    initialized: false
};

// Methods can maintain connection state
connect(job: ActivityStream, credentials: CredentialsObject, cb: PlatformCallback) {
    // Connect using credentials
    this.client = new SomeProtocolClient(credentials.object);
    this.config.initialized = true;
    cb();
}
```

## Real Examples

### Webhook Platform (Stateless)

```typescript
export default class Webhook implements PlatformInterface {
    debug;
    config = { persist: false };

    constructor(session: PlatformSession) {
        this.debug = session.debug;
    }

    get schema() {
        return {
            name: "webhook",
            version: "1.0.0",
            messages: {
                properties: { type: { enum: ["post"] } }
            }
        };
    }

    async post(job: ActivityStream, cb: PlatformCallback) {
        try {
            await fetch(job.target.id, {
                method: 'POST',
                body: JSON.stringify(job.object),
                headers: { 'Content-Type': 'application/json' }
            });
            cb();
        } catch (err) {
            cb(err);
        }
    }

    cleanup(cb: PlatformCallback) { cb(); }
}
```

### Chat Bot (Persistent)

```typescript
export default class ChatBot implements PlatformInterface {
    debug;
    config = {
        persist: true,
        requireCredentials: ["connect"],
        initialized: false
    };
    private client;

    constructor(session: PlatformSession) {
        this.debug = session.debug;
        this.sendToClient = session.sendToClient;
    }

    connect(job: ActivityStream, credentials: CredentialsObject, cb: PlatformCallback) {
        this.client = new ChatService(credentials.object.token);
        this.client.on('message', (msg) => {
            this.sendToClient({
                type: 'send',
                context: 'chatbot',
                actor: { id: msg.from, type: 'person' },
                object: { type: 'note', content: msg.text }
            });
        });
        this.config.initialized = true;
        cb();
    }

    join(job: ActivityStream, cb: PlatformCallback) {
        if (!this.config.initialized) return cb("Not connected");
        this.client.joinRoom(job.target.id);
        cb();
    }

    cleanup(cb: PlatformCallback) {
        if (this.client) this.client.disconnect();
        this.config.initialized = false;
        cb();
    }
}
```

## Reference

### Example Platforms
- **[Dummy Platform](../packages/platform-dummy/README.md)** - Simple testing platform
- **[Feeds Platform](../packages/platform-feeds/README.md)** - RSS/Atom feed processing
- **[IRC Platform](../packages/platform-irc/README.md)** - IRC chat protocol
- **[Metadata Platform](../packages/platform-metadata/README.md)** - Web page metadata extraction  
- **[XMPP Platform](../packages/platform-xmpp/README.md)** - XMPP/Jabber messaging

### TypeScript Interfaces
- **[Schemas Package](../packages/schemas/README.md)** - Complete interface definitions and types

### Documentation
- **[Client Guide](client-guide.md)** - How clients send messages to your platform