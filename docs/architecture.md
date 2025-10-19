# Sockethub Architecture

A 30,000-foot view of how Sockethub translates web applications to internet protocols.

## System Overview

Sockethub is a protocol gateway that runs as four coordinated components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Web Client    │    │   Web Client    │
│  (Browser App)  │    │  (Browser App)  │    │  (Browser App)  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │ WebSocket (Socket.IO)
                                 │
                    ┌────────────▼────────────┐
                    │   Sockethub Server      │
                    │ • Session Management    │
                    │ • Validation Pipeline   │
                    │ • Message Encryption    │
                    │ • Process Coordination  │
                    └────────────┬────────────┘
                                 │ Encrypted Job Queue
                                 │
                    ┌────────────▼────────────┐
                    │       Redis             │
                    │ • Encrypted Job Queue   │
                    │ • Encrypted Credentials │
                    │ • Session Isolation     │
                    └────────────┬────────────┘
                                 │ Encrypted Jobs
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼────────┐     ┌──────────▼──────────┐    ┌────────▼────────┐
│ Platform       │     │  Platform           │    │ Platform        │
│ Worker (IRC)   │     │  Worker (XMPP)      │    │ Worker (Feeds)  │
│ • Child Process│     │  • Child Process    │    │ • Child Process │
│ • Protocol Impl│     │  • Protocol Impl    │    │ • Protocol Impl │
└────────────────┘     └─────────────────────┘    └─────────────────┘
```

**Data Flow**: All ActivityStreams messages, credentials, and job data are encrypted before storage or transmission. Each phase handles specific responsibilities:

- **Web App**: Sends standardized ActivityStreams messages
- **Sockethub Server**: Validates, encrypts, and routes messages  
- **Redis Queue**: Stores encrypted jobs and credentials with session isolation
- **Platform Worker**: Decrypts jobs and translates to external protocols

## Core Architectural Decisions

### Process Isolation

Think of Sockethub as a manager supervising multiple specialized workers, where each worker is completely independent:

**Each Platform = Separate Process**: Every protocol (IRC, XMPP, Feeds) runs as its own child process spawned by the main server. If the IRC platform crashes while processing a message, it doesn't affect XMPP or the main server.

**Per-Login Isolation for Persistent Platforms**: For platforms that maintain connections (like IRC or XMPP), each user login gets its own dedicated process. So if Alice connects to IRC as "alice" and Bob connects as "bob", they each get separate IRC processes. This means:
- Alice's IRC connection problems don't affect Bob's
- Memory leaks from one user's connection are contained
- Each user's IRC session can be managed independently

**Why This Matters**: In traditional architectures, one bad connection or memory leak can bring down the entire service. Sockethub's isolation means problems are contained to individual users and platforms.

### Session Isolation

Every client WebSocket connection gets its own completely isolated environment:

- **Unique Session ID**: Generated per connection for complete isolation
- **Dedicated Encryption**: 32-character secret key per session
- **Redis Namespace**: `session:{sessionId}:*` prevents cross-session data access
- **Automatic Cleanup**: All session data cleared on disconnect

### Job Queue Coordination

Redis and BullMQ provide reliable, encrypted communication between server and platforms:

- **Async Processing**: Server doesn't block waiting for platform responses
- **Message Encryption**: All job data encrypted before queuing
- **Reliable Delivery**: Jobs persist across restarts and failures
- **Platform Routing**: Each platform has dedicated queues per session

## Message Flow

### Client to Platform

```
1. Client sends ActivityStreams message via WebSocket
2. Server validates message through middleware pipeline
3. Server encrypts message and adds to platform's job queue
4. Platform worker receives encrypted job from queue
5. Platform worker decrypts job and calls appropriate method
6. Platform translates to external protocol (IRC, XMPP, HTTP, etc.)
7. Platform sends response back through queue to client
```

### Platform to Client

```
1. External service sends data to platform (incoming IRC message, etc.)
2. Platform converts to ActivityStreams format
3. Platform sends message directly to server via IPC
4. Server routes message to appropriate WebSocket client(s)
```

### Example Flow (IRC Message)

```javascript
// 1. Client sends ActivityStreams
{
  "type": "send",
  "context": "irc", 
  "actor": { "id": "mynick", "type": "person" },
  "target": { "id": "#javascript", "type": "room" },
  "object": { "type": "note", "content": "Hello!" }
}

// 2. Server queues encrypted job for IRC platform
// 3. IRC platform worker receives job
// 4. IRC platform sends: "PRIVMSG #javascript :Hello!"
// 5. IRC platform reports success back to client
```

## Security Model

### Encryption Everywhere

- **Session Keys**: Unique 32-character encryption key per client session
- **All Data Encrypted**: ActivityStreams messages, credentials, job data - everything encrypted
- **Job Queue**: All messages encrypted before queuing in Redis
- **No Plaintext**: Sensitive data never stored or transmitted in plaintext

### Multi-Level Isolation

- **Process Level**: Platforms run in separate memory spaces
- **Session Level**: Each client session has isolated Redis namespace
- **Network Level**: Platforms can be sandboxed or run on separate machines
- **Credential Scoping**: Each platform only accesses its own credentials per session

### Validation Pipeline

```
ActivityStreams Message → Schema Validation → Platform Verification → Encryption → Queue
```

## Platform Types

Platforms are configured to operate in two different modes based on their protocol requirements:

### Stateless Platforms
These don't maintain persistent connections and start fresh for each job. Good for protocols like RSS feeds or HTTP APIs where you just fetch data when needed.

### Persistent Platforms  
These maintain long-running connections and require authentication. Examples include IRC (which requires login and maintains a connection to send/receive real-time messages) or XMPP (which keeps a connection open for instant messaging).

The platform configuration determines which mode a platform operates in, affecting how many processes are spawned and how credentials are handled.

## Scalability Characteristics

### Horizontal Scaling

- **Multiple Server Instances**: Load balance WebSocket connections across servers
- **Redis Clustering**: Distribute job queue and credential storage
- **Platform Distribution**: Run platform workers on dedicated machines
- **Geographic Distribution**: Platforms can be closer to target services

### Resource Management

- **Connection Pooling**: Platforms reuse connections where possible
- **Process Lifecycle**: Platform processes automatically cleaned up on session end
- **Memory Limits**: Platform crashes contained to individual processes
- **Job Persistence**: Work survives server restarts

## ActivityStreams Translation

The core value of Sockethub is translating between web-friendly ActivityStreams and traditional internet protocols:

### Incoming Translation
```
IRC: ":alice!user@host PRIVMSG #room :hello world"
  ↓
ActivityStreams: {
  "type": "send",
  "context": "irc",
  "actor": { "id": "alice", "type": "person" },
  "target": { "id": "#room", "type": "room" },
  "object": { "type": "note", "content": "hello world" }
}
```

### Outgoing Translation  
```
ActivityStreams: {
  "type": "join",
  "context": "irc",
  "actor": { "id": "mynick", "type": "person" },
  "target": { "id": "#room", "type": "room" }
}
  ↓
IRC: "JOIN #room"
```

### Unified Interface

Web applications send the same ActivityStreams format regardless of target protocol:

```javascript
// Same message format works for IRC, XMPP, or any messaging platform
{
  "type": "send",
  "context": "irc",  // or "xmpp" 
  "actor": { "id": "user", "type": "person" },
  "target": { "id": "#room", "type": "room" },
  "object": { "type": "note", "content": "Hello!" }
}
```

## Extension Points

### Custom Platforms

Create new platforms by implementing the standard interface and packaging as npm modules following the `@sockethub/platform-*` naming convention. Add to the platform configuration array to enable.

### Middleware Pipeline

Extend server functionality through middleware for custom validation, message transformation, authentication integration, or monitoring.

This architecture provides a robust, secure, and scalable foundation for bridging web applications with any internet protocol while maintaining strong isolation and reliability guarantees.
