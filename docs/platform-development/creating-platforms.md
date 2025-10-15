# Creating Sockethub Platforms

This guide explains how to create custom platforms for Sockethub, enabling support for
new protocols and services.

## Overview

A Sockethub platform is a Node.js module that:

1. **Translates ActivityStreams messages** into protocol-specific actions
2. **Wraps existing npm modules** that implement the target protocol
3. **Handles authentication and connection management**
4. **Converts protocol responses** back to ActivityStreams format
5. **Provides a schema** defining supported message types

## Platform Structure

### Basic Platform Template

```javascript
import { SomeProtocolClient } from 'some-protocol-npm-module';

export default class MyProtocol {
    constructor(session) {
        this.id = session.id;
        this.debug = session.debug;
        this.sendToClient = session.sendToClient;
        this.config = {
            requireCredentials: ['connect'],
            initialized: false
        };
    }

    // Schema definition
    get schema() {
        return {
            context: 'my-protocol',
            types: {
                connect: { /* schema */ },
                send: { /* schema */ },
                // ... other verbs
            },
            credentials: {
                type: 'object',
                properties: {
                    server: { type: 'string' },
                    username: { type: 'string' },
                    password: { type: 'string' }
                },
                required: ['server', 'username', 'password']
            }
        };
    }

    // Connection method
    async connect(job, credentials, done) {
        try {
            this.client = new SomeProtocolClient({
                server: credentials.server,
                username: credentials.username,
                password: credentials.password
            });
            
            await this.client.connect();
            this.config.initialized = true;
            done();
        } catch (error) {
            done(`Connection failed: ${error.message}`);
        }
    }

    // Message sending method
    async send(job, done) {
        if (!this.config.initialized) {
            return done('Not connected');
        }

        try {
            await this.client.sendMessage(
                job.target['@id'],
                job.object.content
            );
            done();
        } catch (error) {
            done(`Send failed: ${error.message}`);
        }
    }

    // Cleanup method
    cleanup(done) {
        if (this.client) {
            this.client.disconnect();
        }
        this.config.initialized = false;
        done();
    }
}
```

## Step-by-Step Guide

### 1. Find or Create Protocol Implementation

First, find an npm module that implements your target protocol:

```bash
npm search "my-protocol client"
```

Or create your own protocol implementation if none exists.

### 2. Create Platform Package

Create a new package in the `packages/` directory:

```bash
mkdir packages/platform-myprotocol
cd packages/platform-myprotocol
```

### 3. Create package.json

```json
{
  "name": "@sockethub/platform-myprotocol",
  "description": "A sockethub platform module implementing MyProtocol functionality",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
  "dependencies": {
    "my-protocol-client": "^1.0.0"
  },
  "peerDependencies": {
    "@sockethub/server": "workspace:*"
  }
}
```

### 4. Implement Core Methods

Every platform must implement these methods:

#### Constructor

```javascript
constructor(session) {
    this.id = session.id;                    // Session identifier
    this.debug = session.debug;              // Debug logger function
    this.sendToClient = session.sendToClient; // Function to send messages to client
    this.config = {
        requireCredentials: ['connect'],      // Verbs requiring credentials
        initialized: false                   // Connection state
    };
}
```

#### Schema Definition

```javascript
get schema() {
    return {
        context: 'my-protocol',
        types: {
            connect: {
                type: 'object',
                properties: {
                    '@type': { enum: ['connect'] },
                    context: { enum: ['my-protocol'] },
                    actor: { $ref: '#/definitions/actor' }
                },
                required: ['@type', 'context', 'actor']
            },
            send: {
                type: 'object',
                properties: {
                    '@type': { enum: ['send'] },
                    context: { enum: ['my-protocol'] },
                    actor: { $ref: '#/definitions/actor' },
                    target: { $ref: '#/definitions/actor' },
                    object: {
                        type: 'object',
                        properties: {
                            '@type': { enum: ['note'] },
                            content: { type: 'string' }
                        },
                        required: ['@type', 'content']
                    }
                },
                required: ['@type', 'context', 'actor', 'target', 'object']
            }
        },
        credentials: {
            type: 'object',
            properties: {
                server: { type: 'string' },
                username: { type: 'string' },
                password: { type: 'string' }
            },
            required: ['server', 'username', 'password']
        }
    };
}
```

#### Verb Implementations

Each supported verb gets its own method:

```javascript
// Connect to the service
async connect(job, credentials, done) {
    // Implementation
}

// Send a message
async send(job, done) {
    // Implementation
}

// Join a room/channel
async join(job, done) {
    // Implementation
}

// Leave a room/channel
async leave(job, done) {
    // Implementation
}

// Update status/presence
async update(job, done) {
    // Implementation
}

// Cleanup when shutting down
cleanup(done) {
    // Implementation
}
```

### 5. Handle Incoming Events

If your protocol receives incoming messages, set up event handlers:

```javascript
connect(job, credentials, done) {
    this.client = new ProtocolClient(credentials);
    
    // Handle incoming messages
    this.client.on('message', (message) => {
        this.sendToClient({
            '@type': 'message',
            context: 'my-protocol',
            actor: { '@id': message.from, '@type': 'person' },
            target: { '@id': message.to, '@type': 'person' },
            object: {
                '@type': 'note',
                content: message.body,
                published: new Date().toISOString()
            }
        });
    });
    
    // Handle presence updates
    this.client.on('presence', (presence) => {
        this.sendToClient({
            '@type': 'update',
            context: 'my-protocol',
            actor: { '@id': presence.from, '@type': 'person' },
            object: {
                '@type': 'presence',
                presence: presence.status
            }
        });
    });
    
    this.client.connect().then(() => {
        this.config.initialized = true;
        done();
    }).catch(done);
}
```

## Testing Your Platform

### 1. Unit Tests

Create tests in `src/test/`:

```javascript
import { describe, it, expect } from 'bun:test';
import MyProtocol from '../index.js';

describe('MyProtocol Platform', () => {
    it('should initialize correctly', () => {
        const session = {
            id: 'test-session',
            debug: () => {},
            sendToClient: () => {}
        };
        
        const platform = new MyProtocol(session);
        expect(platform.id).toBe('test-session');
    });
    
    it('should validate schema', () => {
        const platform = new MyProtocol({});
        const schema = platform.schema;
        expect(schema.context).toBe('my-protocol');
    });
});
```

### 2. Integration Testing

Test with the dummy client in the examples:

```javascript
// In browser console at localhost:10550/examples/
const sc = new SockethubClient(io('http://localhost:10550', {
    path: '/sockethub'
}));

// Set credentials
sc.socket.emit('credentials', {
    context: 'my-protocol',
    actor: { '@id': 'test@example.com', '@type': 'person' },
    object: {
        '@type': 'credentials',
        server: 'my-server.com',
        username: 'testuser',
        password: 'testpass'
    }
});

// Test connection
sc.socket.emit('message', {
    '@type': 'connect',
    context: 'my-protocol',
    actor: { '@id': 'test@example.com', '@type': 'person' }
});
```

## Platform Configuration

### 1. Register Platform

Add your platform to the main Sockethub configuration:

```json
{
  "platforms": {
    "my-protocol": {
      "enabled": true,
      "package": "@sockethub/platform-myprotocol"
    }
  }
}
```

### 2. Add to Monorepo

Update the root `package.json`:

```json
{
  "workspaces": [
    "packages/*",
    "packages/platform-myprotocol"
  ]
}
```

## Best Practices

### Error Handling

- Always call `done()` with an error message on failure
- Use descriptive error messages that help users debug issues
- Handle network timeouts and connection failures gracefully

### Logging

- Use `this.debug()` for debugging information
- Include relevant context in log messages
- Follow the pattern: `this.debug('action description', additionalData)`

### State Management

- Use `this.config.initialized` to track connection state
- Clean up resources in the `cleanup()` method
- Handle reconnection scenarios

### Schema Design

- Follow JSON Schema standards
- Use references for common objects (actor, target)
- Validate all required properties
- Provide clear descriptions for properties

### ActivityStreams Compliance

- Use standard ActivityStreams types when possible
- Include proper timestamps (`published`, `updated`)
- Follow the actor/target/object pattern consistently

## Examples

Study existing platforms for reference:

- **[Dummy Platform](../../packages/platform-dummy/)** - Simple testing platform
- **[Feeds Platform](../../packages/platform-feeds/)** - RSS/Atom feed processing
- **[IRC Platform](../../packages/platform-irc/)** - IRC protocol implementation
- **[XMPP Platform](../../packages/platform-xmpp/)** - XMPP/Jabber support

## Next Steps

- **[Platform API Reference](platform-api.md)** - Detailed API documentation
- **[Testing Guide](testing.md)** - Comprehensive testing strategies
- **[Schema Reference](../client/activitystreams.md)** - ActivityStreams schema details
