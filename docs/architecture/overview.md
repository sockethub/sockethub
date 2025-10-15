# Sockethub Architecture

This document provides a technical overview of Sockethub's architecture and how the
various components work together to provide protocol translation services.

## High-Level Architecture

Sockethub is designed as a modular, distributed system with five major components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Web Client    │    │   Web Client    │
│  (Browser App)  │    │  (Browser App)  │    │  (Browser App)  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │ WebSocket/Socket.IO
                                 │
                    ┌────────────▼────────────┐
                    │    Sockethub Server     │
                    │   (Core/Dispatcher)     │
                    └────────────┬────────────┘
                                 │ Job Queue (Redis)
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼───────┐     ┌──────────▼──────────┐    ┌────────▼────────┐
│ Platform Inst │     │  Platform Instance  │    │ Platform Inst   │
│    (IRC)      │     │      (XMPP)         │    │   (Feeds)       │
└───────────────┘     └─────────────────────┘    └─────────────────┘
```

## Core Components

### 1. Sockethub Server (Core/Dispatcher)

**Location**: `packages/server/`

The central orchestrator that:

- **Manages WebSocket connections** from web clients using Socket.IO
- **Validates incoming messages** against ActivityStreams schemas
- **Routes messages** to appropriate platform instances
- **Handles credential management** with encryption/decryption
- **Manages the middleware pipeline** for request processing
- **Coordinates session management** per client connection

**Key Files**:

- `src/sockethub.ts` - Main server class
- `src/middleware/` - Request processing pipeline
- `src/platform-instance.ts` - Platform process management

### 2. Job Queue System

**Location**: `packages/data-layer/`

Redis-based queuing infrastructure using BullMQ that:

- **Provides reliable message delivery** between server and platforms
- **Handles message encryption** for security
- **Manages job persistence** and retry logic
- **Enables horizontal scaling** of platform instances
- **Isolates sessions** for multi-tenant security

**Key Classes**:

- `JobQueue` - Server-side job creation and management
- `JobWorker` - Platform-side job processing
- `CredentialsStore` - Encrypted credential storage

### 3. Platform Instances

**Location**: `packages/platform-*/`

Child processes that handle protocol-specific logic:

- **Run in isolated processes** for stability and security
- **Translate ActivityStreams** to protocol-specific actions
- **Maintain persistent connections** to external services
- **Handle incoming events** from protocols
- **Convert protocol responses** back to ActivityStreams

**Examples**:

- `platform-irc` - IRC protocol implementation
- `platform-xmpp` - XMPP/Jabber messaging
- `platform-feeds` - RSS/Atom feed processing

### 4. Client Library

**Location**: `packages/client/`

Browser JavaScript library that:

- **Provides simplified API** for web applications
- **Handles WebSocket connection** management
- **Formats ActivityStreams messages** correctly
- **Manages event handling** for responses
- **Provides helper functions** for common operations

### 5. Message Schemas

**Location**: `packages/schemas/`

TypeScript definitions and JSON schemas that:

- **Define ActivityStreams structure** for all messages
- **Provide type safety** for TypeScript applications
- **Validate message format** at runtime
- **Document expected message structure** for platforms

## Message Flow

### 1. Client to Platform

```
1. Client creates ActivityStreams message
2. Client sends via WebSocket to Sockethub Server
3. Server validates message against schema
4. Server encrypts and queues job for target platform
5. Platform instance processes job from queue
6. Platform translates to protocol-specific action
7. Platform executes action on external service
8. Platform sends completion/failure response back
```

### 2. Platform to Client

```
1. External service sends data to platform
2. Platform converts to ActivityStreams format
3. Platform sends message to server via callback
4. Server routes message to appropriate client(s)
5. Client receives message via WebSocket
```

## Process Model

### Server Process

- **Single Node.js process** handling all client connections
- **Socket.IO server** for WebSocket management
- **Redis connections** for job queue and credential storage
- **Child process spawning** for platform instances

### Platform Processes

- **Separate Node.js process** per platform instance
- **One instance per active client session + platform combination**
- **Independent memory space** prevents crashes from affecting other platforms
- **Dedicated Redis queue worker** for job processing

### Benefits of Process Isolation

- **Crash isolation**: Platform crashes don't affect server or other platforms
- **Resource isolation**: Memory leaks contained to individual processes
- **Security isolation**: Platforms can't access each other's data
- **Scalability**: Can run platform processes on different machines

## Data Flow

### Credential Handling

```
1. Client sends credentials to server
2. Server encrypts credentials with session-specific key
3. Server stores encrypted credentials in Redis
4. Platform requests credentials when needed
5. Server decrypts and provides credentials to platform
6. Platform uses credentials for authentication
```

### Session Management

```
1. Client connects via WebSocket
2. Server creates unique session ID
3. Server creates isolated Redis namespace for session
4. All platform instances for this session share namespace
5. Session data isolated from other clients
6. Session cleanup on client disconnect
```

## Security Model

### Encryption

- **Credentials encrypted** using AES-256 with session-specific keys
- **Job data encrypted** in Redis queues
- **No plaintext secrets** stored in Redis
- **Automatic key rotation** on session creation

### Isolation

- **Process-level isolation** between platforms
- **Session-level isolation** for data storage
- **Network isolation** options for platform processes
- **Credential scoping** per platform per session

### Validation

- **JSON Schema validation** for all incoming messages
- **ActivityStreams compliance** checking
- **Input sanitization** before platform processing
- **Rate limiting** (configurable)

## Configuration System

### Server Configuration

```json
{
  "host": "localhost",
  "port": 10550,
  "redis": {
    "url": "redis://localhost:6379"
  },
  "platforms": {
    "irc": { "enabled": true },
    "xmpp": { "enabled": true }
  }
}
```

### Platform Configuration

- Each platform defines its own schema and requirements
- Platforms can specify credential requirements
- Optional platform-specific configuration sections

## Extensibility

### Adding New Platforms

1. Create platform package implementing standard interface
2. Define ActivityStreams schema for supported verbs
3. Register platform in server configuration
4. Platform automatically loaded and available

### Middleware System

- **Request pipeline** allows custom validation and processing
- **Plugin architecture** for extending server functionality
- **Hook system** for custom authentication and authorization

### Custom Schemas

- **Platform-specific schemas** can extend base ActivityStreams
- **Validation customization** per platform
- **Type system integration** with TypeScript

## Performance Characteristics

### Scalability

- **Horizontal scaling** via multiple server instances
- **Platform distribution** across multiple machines
- **Redis clustering** for high-availability queuing
- **Load balancing** at WebSocket level

### Reliability

- **Job persistence** in Redis ensures message delivery
- **Process restart** on platform crashes
- **Connection recovery** for external services
- **Graceful degradation** when platforms unavailable

### Monitoring

- **Structured logging** throughout system
- **Metrics collection** for performance monitoring
- **Health checks** for platform processes
- **Error aggregation** with optional Sentry integration

## Development Workflow

### Local Development

1. **Start Redis** server locally
2. **Run Sockethub** in development mode
3. **Platform auto-loading** from packages directory
4. **Hot reloading** for platform changes
5. **Debug logging** available throughout

### Testing Strategy

- **Unit tests** for individual components
- **Integration tests** with Redis
- **End-to-end tests** with real platform connections
- **Mock platforms** for testing client applications

This architecture provides a robust, scalable foundation for protocol translation while
maintaining security, reliability, and extensibility.
