# Platform API Reference

This document provides a comprehensive reference for developing Sockethub platforms, including all interfaces, types, and required methods.

## Overview

A Sockethub platform is a Node.js class that implements the `PlatformInterface` and handles translation between ActivityStreams messages and protocol-specific actions.

## Core Interfaces

### PlatformInterface

All platforms must implement this interface:

```typescript
interface PlatformInterface {
    debug: Logger;
    credentialsHash?: string;
    get config(): PlatformConfig;
    get schema(): PlatformSchemaStruct;
    cleanup(cb: PlatformCallback): void;
}
```

### Platform Constructor

```typescript
class MyPlatform implements PlatformInterface {
    constructor(session: PlatformSession) {
        this.debug = session.debug;
        this.sendToClient = session.sendToClient;
        this.updateActor = session.updateActor;
    }
}
```

## Session Interface

The `PlatformSession` object passed to the constructor provides:

```typescript
interface PlatformSession {
    debug: Logger;                              // Debug logging function
    sendToClient: PlatformSendToClient;         // Send messages to client
    updateActor: PlatformUpdateActor;           // Update actor credentials
}
```

### Debug Logger

```typescript
interface Logger {
    (msg: string, data?: any): void;
}

// Usage examples
this.debug('Connection established');
this.debug('Received message', { from: 'user@example.com', content: 'Hello' });
this.debug('Error occurred', error);
```

### Send to Client

```typescript
type PlatformSendToClient = (
    msg: ActivityStream,
    special?: string
) => void;

// Usage example
this.sendToClient({
    '@type': 'send',
    context: 'my-platform',
    actor: { '@id': 'user@example.com', '@type': 'person' },
    target: { '@id': 'recipient@example.com', '@type': 'person' },
    object: {
        '@type': 'note',
        content: 'Hello from platform!'
    }
});
```

### Update Actor

```typescript
type PlatformUpdateActor = (credentials: object) => Promise<void>;

// Usage example - update credentials after successful auth
await this.updateActor({
    server: 'chat.example.com',
    username: 'updated-username',
    token: 'new-auth-token'
});
```

## Configuration

Platforms can be either stateless or persistent:

### Stateless Configuration

```typescript
interface StatelessPlatformConfig {
    persist: false;
    requireCredentials?: string[];              // Optional verbs requiring credentials
    connectTimeoutMs?: number;                  // Connection timeout in milliseconds
}

// Example
config: StatelessPlatformConfig = {
    persist: false,
    requireCredentials: ['fetch']               // Only 'fetch' verb needs credentials
};
```

### Persistent Configuration

```typescript
interface PersistentPlatformConfig {
    persist: true;
    requireCredentials: string[];               // Required verbs needing credentials
    initialized: boolean;                       // Connection state tracking
    connectTimeoutMs?: number;                  // Connection timeout in milliseconds
}

// Example
config: PersistentPlatformConfig = {
    persist: true,
    requireCredentials: ['connect', 'send', 'join'],
    initialized: false,
    connectTimeoutMs: 30000
};
```

## Schema Definition

The schema defines your platform's capabilities and message validation:

```typescript
interface PlatformSchemaStruct {
    name: string;                               // Platform name (context value)
    version: string;                            // Platform version
    credentials?: object;                       // JSON schema for credentials
    messages?: {                                // Message validation schema
        required?: string[];
        properties?: {
            type?: {
                enum?: string[];                // Supported verb types
            };
        };
    };
}
```

### Example Schema

```typescript
get schema(): PlatformSchemaStruct {
    return {
        name: 'my-platform',
        version: '1.0.0',
        messages: {
            required: ['type'],
            properties: {
                type: {
                    enum: ['connect', 'send', 'join', 'leave', 'disconnect']
                }
            }
        },
        credentials: {
            type: 'object',
            properties: {
                server: { type: 'string' },
                username: { type: 'string' },
                password: { type: 'string' },
                port: { type: 'number', default: 5222 }
            },
            required: ['server', 'username', 'password']
        }
    };
}
```

## Activity Stream Types

### ActivityStream Interface

```typescript
interface ActivityStream {
    id?: string;                                // Optional message ID
    type: string;                               // Verb type (@type in JSON)
    context: string;                            // Platform name
    actor: ActivityActor;                       // Who is performing the action
    object?: ActivityObject;                    // What is being acted upon
    target?: ActivityActor;                     // Where/who to send to
    error?: string;                             // Error message (for failures)
}
```

### ActivityActor Interface

```typescript
interface ActivityActor {
    id: string;                                 // Unique identifier
    type: string;                               // Actor type (person, service, etc.)
    name?: string;                              // Display name
    [key: string]: unknown;                     // Additional properties
}
```

### ActivityObject Interface

```typescript
interface ActivityObject {
    id?: string;                                // Optional object ID
    type: string;                               // Object type (note, credentials, etc.)
    content?: string;                           // Message content
    [key: string]: unknown;                     // Additional properties
}
```

## Verb Implementation

### Method Naming

Platform methods are named after the ActivityStreams verb types they handle:

```typescript
// Handle '@type': 'connect'
async connect(job: ActivityStream, credentials: object, done: PlatformCallback): Promise<void>

// Handle '@type': 'send'  
async send(job: ActivityStream, done: PlatformCallback): Promise<void>

// Handle '@type': 'join'
async join(job: ActivityStream, done: PlatformCallback): Promise<void>

// Handle '@type': 'custom-verb'
async customVerb(job: ActivityStream, done: PlatformCallback): Promise<void>
```

### Callback Interface

```typescript
type PlatformCallback = (
    err?: string | Error,                       // Error message or Error object
    data?: ActivityStream | ASCollection        // Response data
) => void;
```

### Common Verb Patterns

#### Connect Verb

```typescript
async connect(job: ActivityStream, credentials: any, done: PlatformCallback) {
    try {
        // Initialize client with credentials
        this.client = new ProtocolClient({
            server: credentials.server,
            username: credentials.username,
            password: credentials.password
        });

        // Set up event listeners for incoming messages
        this.client.on('message', this.handleIncomingMessage.bind(this));
        this.client.on('error', this.handleError.bind(this));

        // Connect to service
        await this.client.connect();
        
        // Update connection state
        this.config.initialized = true;
        
        // Signal success
        done();
    } catch (error) {
        done(`Connection failed: ${error.message}`);
    }
}
```

#### Send Verb

```typescript
async send(job: ActivityStream, done: PlatformCallback) {
    if (!this.config.initialized) {
        return done('Not connected to service');
    }

    try {
        // Extract message details from ActivityStream
        const targetId = job.target?.id;
        const content = job.object?.content;
        
        // Send via protocol client
        await this.client.sendMessage(targetId, content);
        
        // Signal success (optionally return modified job)
        done(null, job);
    } catch (error) {
        done(`Send failed: ${error.message}`);
    }
}
```

#### Stateless Verb (e.g., fetch)

```typescript
async fetch(job: ActivityStream, done: PlatformCallback) {
    try {
        const url = job.object?.url;
        
        // Perform fetch operation
        const response = await this.fetchData(url);
        
        // Format response as ActivityStream
        const result: ActivityStream = {
            '@type': 'fetch',
            context: this.schema.name,
            actor: job.actor,
            object: {
                '@type': 'data',
                content: response
            }
        };
        
        done(null, result);
    } catch (error) {
        done(`Fetch failed: ${error.message}`);
    }
}
```

## Event Handling

### Incoming Protocol Events

Set up listeners for protocol-specific events and convert them to ActivityStreams:

```typescript
private handleIncomingMessage(protocolMessage: any) {
    // Convert protocol message to ActivityStream format
    const activityStream: ActivityStream = {
        '@type': 'send',
        context: this.schema.name,
        actor: {
            '@id': protocolMessage.from,
            '@type': 'person'
        },
        target: {
            '@id': protocolMessage.to,
            '@type': 'person'
        },
        object: {
            '@type': 'note',
            content: protocolMessage.body,
            published: new Date().toISOString()
        }
    };

    // Send to client
    this.sendToClient(activityStream);
}
```

### Error Handling

```typescript
private handleError(error: any) {
    this.debug('Protocol error occurred', error);
    
    // Send error to client
    this.sendToClient({
        '@type': 'error',
        context: this.schema.name,
        actor: { '@id': 'system', '@type': 'service' },
        object: {
            '@type': 'error',
            content: error.message
        },
        error: error.message
    });
}
```

## Cleanup Method

Required method for platform shutdown:

```typescript
cleanup(done: PlatformCallback) {
    try {
        // Disconnect from external services
        if (this.client) {
            this.client.disconnect();
        }
        
        // Clear any intervals/timeouts
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        // Reset state
        this.config.initialized = false;
        this.client = null;
        
        // Signal completion
        done();
    } catch (error) {
        done(`Cleanup failed: ${error.message}`);
    }
}
```

## Advanced Features

### Credential Validation

```typescript
private validateCredentials(credentials: any): boolean {
    const required = ['server', 'username', 'password'];
    return required.every(field => credentials[field]);
}

async connect(job: ActivityStream, credentials: any, done: PlatformCallback) {
    if (!this.validateCredentials(credentials)) {
        return done('Invalid credentials: missing required fields');
    }
    // ... continue with connection
}
```

### State Management

```typescript
class MyPlatform implements PlatformInterface {
    private connections = new Map<string, any>();
    private subscriptions = new Set<string>();
    
    // Track multiple connections or subscriptions
    async join(job: ActivityStream, done: PlatformCallback) {
        const roomId = job.target?.id;
        
        if (this.subscriptions.has(roomId)) {
            return done(`Already joined ${roomId}`);
        }
        
        // Join room and track subscription
        await this.client.joinRoom(roomId);
        this.subscriptions.add(roomId);
        
        done();
    }
}
```

### Rate Limiting

```typescript
class MyPlatform implements PlatformInterface {
    private messageQueue: Array<() => void> = [];
    private rateLimitMs = 1000; // 1 message per second
    
    constructor(session: PlatformSession) {
        super(session);
        
        // Process queue with rate limiting
        setInterval(() => {
            const next = this.messageQueue.shift();
            if (next) next();
        }, this.rateLimitMs);
    }
    
    async send(job: ActivityStream, done: PlatformCallback) {
        // Add to rate-limited queue
        this.messageQueue.push(async () => {
            try {
                await this.client.sendMessage(job.target?.id, job.object?.content);
                done();
            } catch (error) {
                done(error.message);
            }
        });
    }
}
```

## Testing Your Platform

### Unit Testing Template

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import MyPlatform from '../src/index.js';

describe('MyPlatform', () => {
    let platform: MyPlatform;
    let mockSession: PlatformSession;
    
    beforeEach(() => {
        mockSession = {
            debug: () => {},
            sendToClient: () => {},
            updateActor: async () => {}
        };
        platform = new MyPlatform(mockSession);
    });
    
    it('should implement required interface', () => {
        expect(platform.schema).toBeDefined();
        expect(platform.config).toBeDefined();
        expect(typeof platform.cleanup).toBe('function');
    });
    
    it('should validate schema', () => {
        const schema = platform.schema;
        expect(schema.name).toBe('my-platform');
        expect(schema.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
});
```

### Integration Testing

```typescript
// Test with actual ActivityStream messages
it('should handle send message', (done) => {
    const job: ActivityStream = {
        '@type': 'send',
        context: 'my-platform',
        actor: { '@id': 'user@example.com', '@type': 'person' },
        target: { '@id': 'friend@example.com', '@type': 'person' },
        object: { '@type': 'note', content: 'Test message' }
    };
    
    platform.send(job, (err, result) => {
        expect(err).toBeUndefined();
        expect(result).toBeDefined();
        done();
    });
});
```

## Error Handling Best Practices

### Consistent Error Messages

```typescript
// Use descriptive, actionable error messages
done('Connection failed: Invalid credentials');
done('Send failed: User not found');
done('Join failed: Room does not exist');

// Include relevant context
done(`Authentication failed for user ${credentials.username}`);
done(`Message too long: ${content.length} chars (max: 500)`);
```

### Error Types

```typescript
// Network/connection errors
done('Connection timeout: Could not reach server');

// Authentication errors  
done('Authentication failed: Invalid username or password');

// Protocol errors
done('Protocol error: Server rejected message format');

// Validation errors
done('Invalid message: Missing required field "content"');
```

## Performance Considerations

### Connection Pooling

```typescript
// For platforms that support multiple connections
class MyPlatform implements PlatformInterface {
    private connectionPool = new Map<string, ClientConnection>();
    
    private getConnection(credentials: any): ClientConnection {
        const key = `${credentials.server}:${credentials.username}`;
        
        if (!this.connectionPool.has(key)) {
            const conn = new ClientConnection(credentials);
            this.connectionPool.set(key, conn);
        }
        
        return this.connectionPool.get(key);
    }
}
```

### Memory Management

```typescript
cleanup(done: PlatformCallback) {
    // Clear all references to prevent memory leaks
    this.connectionPool.clear();
    this.messageQueue.length = 0;
    this.subscriptions.clear();
    
    // Remove event listeners
    if (this.client) {
        this.client.removeAllListeners();
        this.client.disconnect();
    }
    
    done();
}
```

## See Also

- **[Creating Platforms Guide](creating-platforms.md)** - Step-by-step platform development
- **[Platform Testing](testing.md)** - Comprehensive testing strategies
- **[ActivityStreams Reference](../client/activitystreams.md)** - Message format details
- **[Schema Documentation](../../packages/schemas/README.md)** - Type definitions and validation