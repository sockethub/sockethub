# Sockethub Queue System

The queue system is Sockethub's core infrastructure that enables reliable, scalable communication between web clients and protocol platforms.

## Why a Queue System?

Web applications need to communicate with network protocols (IRC, XMPP, RSS) that:
- Have slow or unreliable connections
- Require persistent state that browsers can't maintain  
- Need to operate across multiple concurrent user sessions

The queue system solves this by:
- **Decoupling** web clients from protocol complexity
- **Ensuring reliability** through message persistence
- **Enabling concurrency** via process isolation
- **Maintaining security** through encrypted message handling

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Clients   │    │  Sockethub      │    │   Protocol      │
│                 │    │  Queue System   │    │   Platforms     │
│ • Browser Apps  │◄──►│                 │◄──►│                 │
│ • Mobile Apps   │    │ • Job Queues    │    │ • IRC Client    │
│ • Desktop Apps  │    │ • Message       │    │ • XMPP Client   │
│ • APIs          │    │   Routing       │    │ • RSS Parser    │
│                 │    │ • Session Mgmt  │    │ • Metadata      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Message Flow

### 1. Web Request → Queue
```
Web App → Socket.IO → Sockethub Server → Redis Queue
```
- Client sends ActivityStreams message
- Server validates and queues the request
- Client gets immediate acknowledgment

### 2. Queue → Platform Processing  
```
Redis Queue → Platform Worker → External Protocol → Response
```
- Platform worker picks up job
- Processes protocol-specific logic in isolation
- Connects to external services (IRC, XMPP, etc.)

### 3. Response → Client
```
Platform Result → Queue Event → Sockethub Server → Socket.IO → Web App
```
- Results flow back through the queue
- Real-time updates delivered via Socket.IO
- Clients receive responses and ongoing events

## Key Design Principles

**Process Isolation**: Each protocol runs in its own child process
- Crashed platforms don't affect others
- Memory leaks and resource issues are contained
- Different platforms can use different dependencies

**Session-Based Queues**: Each client gets dedicated queue infrastructure  
- Complete privacy between users
- Natural load distribution
- Session-specific configurations possible

**Message Durability**: All messages persist until processed
- Server restarts don't lose messages
- Failed operations can be retried
- Audit trail for debugging

## Real-World Example

A chat application connecting to both IRC and XMPP:

```
User message → Queue → [IRC Platform] + [XMPP Platform]
                          ↓               ↓
                     IRC Network    XMPP Network
```

**Benefits:**
- Both protocols process concurrently
- Slow IRC doesn't block XMPP messages  
- Platform crashes only affect that protocol
- Independent delivery confirmations

## Operational Characteristics

**Reliability**: Messages are never lost, even during:
- Server restarts
- Platform process crashes  
- Temporary network failures
- Redis downtime

**Scalability**: Natural horizontal scaling:
- Multiple server instances share Redis
- Per-session queue isolation
- No coordination between servers required

**Performance**: Asynchronous design provides:
- Immediate web request responses
- Concurrent protocol processing
- Efficient resource utilization

## Related Documentation

- [Data Layer Package README](README.md) - Package overview and usage
- [Main Sockethub README](../../README.md) - Overall project documentation
- [BullMQ Documentation](https://bullmq.io/) - Underlying queue library
- [ActivityStreams Specification](https://www.w3.org/TR/activitystreams-core/) - Message format standard
