# Message Flow

This document provides a detailed breakdown of how messages flow through Sockethub's
architecture, from client request to platform response and back.

## Overview

Sockethub processes messages through several distinct phases:

1. **Client Connection** - WebSocket connection establishment
2. **Message Reception** - Incoming ActivityStreams message handling
3. **Middleware Pipeline** - Validation, credential handling, and preprocessing
4. **Job Queuing** - Redis-based job distribution
5. **Platform Processing** - Protocol-specific action execution
6. **Response Handling** - Success/failure response routing
7. **Event Broadcasting** - Incoming platform events to clients

## Detailed Message Flow

### 1. Client Connection Flow

```
┌─────────────┐    WebSocket     ┌─────────────────┐
│   Client    │ ────────────────→│ Sockethub Server│
│ (Browser)   │                  │   (Socket.IO)   │
└─────────────┘                  └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Session Created │
                                 │ - Unique ID     │
                                 │ - Redis namespace│
                                 │ - Encryption key│
                                 └─────────────────┘
```

**Steps:**

1. Client connects to `http://sockethub-server:10550` with Socket.IO
2. Server creates unique session ID
3. Server establishes isolated Redis namespace for session
4. Server generates session-specific encryption key
5. Connection acknowledged to client

### 2. Credential Storage Flow

```
┌─────────────┐  credentials   ┌─────────────────┐
│   Client    │ ──────────────→│ Sockethub Server│
└─────────────┘                └─────────────────┘
                                        │
                                        ▼
                                ┌──────────────────┐
                                │ Credentials      │
                                │ Validation       │
                                └──────────────────┘
                                        │
                                        ▼
                                ┌──────────────────┐
                                │ AES-256 Encrypt  │
                                │ with session key │
                                └──────────────────┘
                                        │
                                        ▼
                                ┌──────────────────┐
                                │ Store in Redis   │
                                │ session namespace│
                                └──────────────────┘
```

**Example credential message:**

```json
{
  "context": "xmpp",
  "actor": {
    "@id": "user@jabber.org",
    "@type": "person"
  },
  "object": {
    "@type": "credentials", 
    "server": "jabber.org",
    "username": "user",
    "password": "secret123"
  }
}
```

### 3. ActivityStreams Message Processing

```
┌─────────────┐   message    ┌─────────────────┐
│   Client    │ ────────────→│ Sockethub Server│
└─────────────┘              └─────────────────┘
                                      │
                                      ▼
                              ┌───────────────────┐
                              │ Middleware        │
                              │ Pipeline          │
                              └───────────────────┘
                                      │
                              ┌───────▼───────────┐
                              │ 1. Validate       │
                              │    Schema         │
                              └───────────────────┘
                                      │
                              ┌───────▼───────────┐
                              │ 2. Expand         │
                              │    ActivityStream │
                              └───────────────────┘
                                      │
                              ┌───────▼───────────┐
                              │ 3. Create         │
                              │    Activity Object│
                              └───────────────────┘
                                      │
                              ┌───────▼───────────┐
                              │ 4. Store          │
                              │    Credentials    │
                              └───────────────────┘
                                      │
                                      ▼
                              ┌───────────────────┐
                              │ Queue Job         │
                              │ for Platform      │
                              └───────────────────┘
```

#### Middleware Pipeline Details

**1. Validate Middleware** (`packages/server/src/middleware/validate.ts`)

- Validates ActivityStreams schema compliance
- Checks required fields (`@type`, `context`, `actor`)
- Verifies platform exists and is enabled
- Returns validation errors if invalid

**2. Expand ActivityStream** (`packages/server/src/middleware/expand-activity-stream.ts`)

- Normalizes ActivityStreams format
- Adds default values for optional fields
- Resolves actor references
- Ensures consistent message structure

**3. Create Activity Object** (`packages/server/src/middleware/create-activity-object.ts`)

- Converts message to internal ActivityObject format
- Adds session metadata
- Generates unique message IDs
- Prepares for platform processing

**4. Store Credentials** (`packages/server/src/middleware/store-credentials.ts`)

- Extracts credentials from message if present
- Encrypts credentials with session key
- Stores in Redis under session namespace
- Removes credentials from message payload

### 4. Job Queue Flow

```
┌─────────────────┐  encrypted   ┌─────────────────┐
│ Middleware      │  job data    │ Redis Job Queue │
│ Pipeline        │ ────────────→│ (BullMQ)        │
└─────────────────┘              └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Platform Worker │
                                 │ Process         │
                                 └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Decrypt Job     │
                                 │ Data            │
                                 └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Platform Method │
                                 │ Execution       │
                                 └─────────────────┘
```

**Job Queue Implementation** (`packages/data-layer/src/job-queue.ts`):

- Uses BullMQ for reliable job processing
- Jobs encrypted before queuing
- Separate queue per platform type
- Retry logic for failed jobs
- Job persistence across server restarts

### 5. Platform Processing Flow

```
┌─────────────────┐              ┌─────────────────┐
│ Platform Worker │   needs      │ Credentials     │
│ Process         │   creds?     │ Store (Redis)   │
└─────────────────┘ ────────────→└─────────────────┘
         │                                │
         │                     ┌──────────▼──────────┐
         │                     │ Decrypt credentials │
         │                     │ with session key    │
         │                     └──────────┬──────────┘
         │                                │
         ▼                                ▼
┌─────────────────┐              ┌─────────────────┐
│ Platform Method │              │ Return decrypted│
│ (e.g., connect, │◄─────────────│ credentials     │
│  send, join)    │              └─────────────────┘
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ External        │
│ Protocol Action │
│ (IRC, XMPP,     │
│  HTTP, etc.)    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Success/Failure │
│ Callback        │
└─────────────────┘
```

**Example Platform Method Flow** (IRC send message):

1. Worker receives encrypted job from queue
2. Worker checks if verb requires credentials (`requireCredentials` config)
3. If needed, worker requests credentials from CredentialsStore
4. CredentialsStore decrypts and returns credentials
5. Platform `send()` method called with job and credentials
6. Platform connects to IRC server (if not connected)
7. Platform sends IRC `PRIVMSG` command
8. Platform receives IRC server response
9. Platform calls callback with success/failure result

### 6. Response Flow

```
┌─────────────────┐  callback    ┌─────────────────┐
│ Platform Method │ ────────────→│ Job Worker      │
└─────────────────┘              └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Format Response │
                                 │ as ActivityStream│
                                 └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Send to Client  │
                                 │ via Socket.IO   │
                                 └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Client receives │
                                 │ 'completed' or  │
                                 │ 'failure' event │
                                 └─────────────────┘
```

**Success Response:**

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

**Failure Response:**

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
  },
  "error": "Connection failed: Invalid credentials"
}
```

### 7. Incoming Event Flow

For platforms that receive events (IRC messages, XMPP presence, etc.):

```
┌─────────────────┐   protocol   ┌─────────────────┐
│ External        │   event      │ Platform        │
│ Service         │ ────────────→│ Instance        │
│ (IRC Server)    │              │                 │
└─────────────────┘              └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Convert to      │
                                 │ ActivityStreams │
                                 └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ sendToClient()  │
                                 │ callback        │
                                 └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Sockethub Server│
                                 │ routes to       │
                                 │ WebSocket       │
                                 └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Client receives │
                                 │ 'message' event │
                                 └─────────────────┘
```

**Example Incoming IRC Message:**

```json
{
  "@type": "send",
  "context": "irc",
  "actor": {
    "@id": "othernick",
    "@type": "person"
  },
  "target": {
    "@id": "#javascript",
    "@type": "room"
  },
  "object": {
    "@type": "note", 
    "content": "Hi everyone!",
    "published": "2024-01-01T12:30:00Z"
  }
}
```

## Session Management

### Session Lifecycle

```
┌─────────────────┐
│ Client Connect  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Create Session  │
│ - Generate ID   │
│ - Create Redis  │
│   namespace     │
│ - Generate      │
│   encryption key│
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Session Active  │
│ - Process msgs  │
│ - Store creds   │ 
│ - Queue jobs    │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Client          │
│ Disconnect      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Cleanup Session │
│ - Stop platforms│
│ - Clear Redis   │
│   namespace     │
│ - Close         │
│   connections   │
└─────────────────┘
```

### Session Isolation

Each client session is completely isolated:

- **Unique session ID** - UUID generated per connection
- **Isolated Redis namespace** - `session:{sessionId}:*`
- **Session-specific encryption** - Unique AES key per session
- **Separate platform instances** - One platform process per session
- **Independent credential storage** - No cross-session data access

## Error Handling and Propagation

### Error Flow

```
┌─────────────────┐   error      ┌─────────────────┐
│ Any Component   │ ────────────→│ Error Handler   │
│ (Platform,      │              │                 │
│  Middleware,    │              └─────────────────┘
│  Server)        │                       │
└─────────────────┘                       ▼
                                 ┌─────────────────┐
                                 │ Format as       │
                                 │ ActivityStreams │
                                 │ failure message │
                                 └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Send to Client  │
                                 │ via 'failure'   │
                                 │ event           │
                                 └─────────────────┘
```

### Error Types and Sources

**Validation Errors** (Middleware):

```json
{
  "@type": "failure",
  "context": "validation",
  "object": {
    "@type": "error",
    "content": "Missing required field: actor"
  },
  "error": "Missing required field: actor"
}
```

**Platform Errors** (Platform Instance):

```json
{
  "@type": "failure", 
  "context": "xmpp",
  "object": {
    "@type": "error",
    "content": "Authentication failed: Invalid password"
  },
  "error": "Authentication failed: Invalid password"
}
```

**System Errors** (Server/Redis):

```json
{
  "@type": "failure",
  "context": "system", 
  "object": {
    "@type": "error",
    "content": "Redis connection lost"
  },
  "error": "Redis connection lost"
}
```

## Performance Considerations

### Message Throughput

- **Concurrent processing** - Multiple platform workers per session
- **Job queue batching** - BullMQ handles job distribution efficiently
- **Redis pipelining** - Batch credential operations
- **WebSocket efficiency** - Binary and compression support

### Memory Management

- **Process isolation** - Platform crashes don't affect server
- **Session cleanup** - Automatic resource deallocation on disconnect
- **Connection pooling** - Reuse platform connections where possible
- **Credential encryption** - No plaintext secrets in memory

### Scalability

- **Horizontal scaling** - Multiple Sockethub server instances
- **Redis clustering** - Distributed job queue and credential storage
- **Platform distribution** - Platform workers on separate machines
- **Load balancing** - WebSocket sticky sessions

## Debugging Message Flow

### Debug Logging

Enable comprehensive logging with environment variables:

```bash
# All Sockethub components
DEBUG=sockethub* bun run start

# Specific components
DEBUG=sockethub:server:middleware bun run start
DEBUG=sockethub:platform:irc bun run start
DEBUG=sockethub:job-queue bun run start
```

### Tracing Messages

Each message can be traced through the system:

1. **Client WebSocket ID** - Unique per connection
2. **Session ID** - Generated on connect  
3. **Message ID** - Generated per ActivityStreams message
4. **Job ID** - Generated when queued
5. **Platform Instance ID** - Unique per platform process

### Monitoring Points

Key monitoring locations:

- **WebSocket connections** - Connection/disconnection events
- **Middleware pipeline** - Validation failures and processing time
- **Job queue** - Queue depth, processing time, failed jobs
- **Platform instances** - Connection status, message throughput
- **Redis operations** - Connection health, operation latency

## See Also

- **[Architecture Overview](overview.md)** - High-level system architecture
- **[Using Platforms](../client/using-platforms.md)** - Client-side message patterns
- **[Creating Platforms](../platform-development/creating-platforms.md)** - Platform development
- **[Configuration](../getting-started/configuration.md)** - System configuration options
