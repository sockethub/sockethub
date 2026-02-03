# Messaging Queue Architecture

This document describes how Sockethub routes ActivityStreams messages between
clients and platform workers using Redis-backed job queues.

## System Components

### Client Layer

- **Sockethub Client**: Browser-based library that handles ActivityStreams message
  formatting and WebSocket communication via Socket.IO
- **WebSocket Connection**: Persistent connection to Sockethub server with unique
  session identifier

### Server Layer (Main Process)

- **Sockethub Server**: Central coordination point managing all client connections
  and message routing
- **JobQueue**: Outbound message queue that sends encrypted jobs to platform
  workers
- **CredentialsStore**: Encrypted credential storage isolated per session

### Queue Layer (Redis)

- **BullMQ Queues**: Reliable job queues with persistence and retry logic
- **Queue Channels**: Multiple Redis keys per queue for different job states
  (waiting, active, completed, failed)
- **Credential Storage**: Session-isolated encrypted credential keys

### Platform Layer (Child Processes)

- **Platform Worker**: Isolated child process implementing specific protocol
  (IRC, XMPP, Feeds, etc.)
- **JobWorker**: Consumes jobs from queue and processes ActivityStreams messages
- **IPC Channel**: Direct communication channel back to main server process

## Queue Naming Pattern

### Structure

Every queue in Redis follows this naming pattern:

```
bull:sockethub-{parentId}-{component}-{platformId}:{state}
```

### Name Components Explained

| Component | Purpose | Examples | Origin |
|-----------|---------|----------|--------|
| **bull** | BullMQ library prefix | `bull` | Fixed prefix added by BullMQ |
| **sockethub** | System prefix | `sockethub` | Hardcoded prefix for all queue IDs |
| **parentId** | Sockethub instance ID | `sh-1a2b` | Generated at sockethub boot |
| **component** | Queue type | `data-layer-queue` | JobQueue / JobWorker |
| **platformId** | Platform instance ID | `irc-7f9c` | From `getPlatformId(...)` |
| **state** | Job state | `meta`, `wait`, `active`, `completed`, `failed` | BullMQ internal states |

### Real Queue Examples

**Main Server Process**:

```
bull:sockethub-sh-1a2b-data-layer-queue-irc-7f9c:meta
bull:sockethub-sh-1a2b-data-layer-queue-irc-7f9c:wait
bull:sockethub-sh-1a2b-data-layer-queue-irc-7f9c:active
bull:sockethub-sh-1a2b-data-layer-queue-irc-7f9c:completed
```

**Platform Child Process**:

```
bull:sockethub-sh-1a2b-data-layer-queue-irc-7f9c:meta
bull:sockethub-sh-1a2b-data-layer-queue-irc-7f9c:wait
```

### Why The Same Name?

Queue names are intentionally **context-independent** because the queue is a
shared resource across processes. We include a stable system prefix and the
sockethub `parentId` so multiple deployments can share a Redis instance without
collisions. Logger context is **not** part of the queue ID.

## Message Routing: Client to Platform

### Journey Overview

A message from the Sockethub Client to an external service (like an IRC server)
follows this path:

```
[Sockethub Client]
       ↓
[WebSocket Connection]
       ↓
[Sockethub Server]
       ↓
[JobQueue: Encrypt & Enqueue]
       ↓
[Redis Queue]
       ↓
[JobWorker: Decrypt & Process]
       ↓
[Platform Handler]
       ↓
[External Protocol]
```

### Detailed Flow

#### 1. Client Sends Message

**Component**: Sockethub Client (browser)

**Action**: User action triggers ActivityStreams message creation

**Message**: ActivityStreams format with type, context, actor, target, object

**Channel**: WebSocket connection via Socket.IO

**Example**: User sends "Hello!" to IRC channel #javascript

---

#### 2. Server Receives Message

**Component**: Sockethub Server (main process)

**Action**: Validates message through middleware pipeline

**Checks**:

- Schema validation (is it valid ActivityStreams?)
- Platform verification (does IRC platform exist?)
- Credential storage (save any credentials if provided)

**Channel**: In-memory processing within server

---

#### 3. Server Queues Job

**Component**: JobQueue (server-side queue manager)

**Action**:

- Encrypts the ActivityStreams message using session secret
- Creates job with encrypted payload
- Adds job to Redis queue

**Queue Name**: `bull:sockethub-sh-1a2b-data-layer-queue-irc-7f9c:wait`

**Name Breakdown**:

- `sockethub`: System prefix
- `sh-1a2b`: Sockethub instance (parent) ID
- `data-layer-queue`: Component that created this queue
- `irc-7f9c`: Platform instance ID (from `getPlatformId`)
- `wait`: Job is waiting to be processed

**Job Data**:

- `title`: Human-readable job identifier (e.g., "irc-send-123")
- `sessionId`: Session identifier for routing responses
- `msg`: Encrypted ActivityStreams message (only decryptable by platform with
  session secret)

---

#### 4. Redis Stores Job

**Component**: Redis (persistence layer)

**Action**: Job stored in multiple Redis keys for queue management

**Keys Created**:

- `bull:...:wait` - List of waiting jobs
- `bull:...:meta` - Queue metadata
- `bull:...:id` - Job ID counter

**Persistence**: Job survives server restarts, platform crashes

---

#### 5. Worker Pulls Job

**Component**: JobWorker (platform child process)

**Action**:

- Monitors Redis queue for new jobs
- Pulls next job from waiting list
- Moves job to active list

**Queue Name**: `bull:sockethub-sh-1a2b-data-layer-queue-irc-7f9c:active`

**Name Breakdown**:

- `sockethub`: System prefix
- `sh-1a2b`: Sockethub instance (parent) ID
- `data-layer-queue`: Component identifier
- `irc-7f9c`: Platform instance ID (same as JobQueue)
- `active`: Job is currently being processed

**Note**: Worker connects using the same queue ID as JobQueue so they target the
exact same Redis keys.

---

#### 6. Worker Decrypts Job

**Component**: JobWorker (platform child process)

**Action**:

- Extracts encrypted message from job
- Decrypts using session secret (shared between server and platform)
- Parses decrypted data back to ActivityStreams format

**Security**: Only this platform worker (with correct session secret) can decrypt the message

---

#### 7. Platform Processes Message

**Component**: Platform Handler (IRC protocol implementation)

**Action**:

- Receives ActivityStreams message
- Translates to IRC protocol command
- Executes IRC command over TCP connection to IRC server

**Translation**: ActivityStreams "send" → IRC "PRIVMSG #javascript :Hello!"

**Result**: Platform returns success/failure result

---

#### 8. Worker Returns Result

**Component**: JobWorker

**Action**:

- Marks job as completed in Redis
- Moves job from active list to completed list
- Emits completion event

**Queue**: Job moved to `bull:...:completed`

**Cleanup**: Job auto-removed from Redis after 5 minutes

---

#### 9. Server Receives Completion

**Component**: JobQueue (server process)

**Action**:

- Listens for completion events from Redis
- Retrieves job result
- Identifies which client session (via sessionId)

**Channel**: Redis pub/sub event notification

---

#### 10. Client Receives Response

**Component**: Sockethub Server → Sockethub Client

**Action**: Server sends result back to client over WebSocket

**Channel**: Socket.IO WebSocket connection

**Message**: Confirmation or error message in ActivityStreams format

## Message Routing: Platform to Client

Incoming messages from external services follow a simpler, faster path:

```
[External Service]
       ↓
[Platform Handler]
       ↓
[IPC Channel]
       ↓
[Sockethub Server]
       ↓
[WebSocket Connection]
       ↓
[Sockethub Client]
```

### Flow Details

#### 1. External Service Sends Data

**Example**: IRC server sends message to channel:
`:alice!user@host PRIVMSG #javascript :Hi everyone!`

**Component**: Platform Handler receives protocol-specific data

---

#### 2. Platform Translates to ActivityStreams

**Component**: Platform Handler (IRC)

**Action**: Converts IRC protocol message to ActivityStreams format

**Translation**: IRC PRIVMSG → ActivityStreams "send" message with actor, target, object

---

#### 3. Platform Sends via IPC

**Component**: Platform Worker child process

**Action**: Sends ActivityStreams message directly to parent (server) process

**Channel**: Inter-Process Communication (IPC) - fast, direct, in-memory channel between processes

**Why Not Queue**: Incoming messages bypass Redis queue for lower latency
(no encryption/decryption needed)

---

#### 4. Server Routes to Client

**Component**: Sockethub Server

**Action**:

- Receives ActivityStreams message via IPC
- Identifies target client session(s)
- Forwards message to appropriate WebSocket connection(s)

**Channel**: Socket.IO WebSocket

---

#### 5. Client Receives Message

**Component**: Sockethub Client

**Action**: Receives ActivityStreams message and triggers application handler

**Result**: Browser app displays the message to user

## Queue Channel States

Each queue exists as multiple Redis keys representing different job states:

### Meta Channel

**Purpose**: Queue configuration and metadata

**Key**: `bull:{queueName}:meta`

**Contents**: Queue options, version info, paused state

---

### Wait Channel

**Purpose**: Jobs waiting to be processed

**Key**: `bull:{queueName}:wait`

**Type**: Redis LIST

**Contents**: Job IDs in FIFO order

---

### Active Channel

**Purpose**: Jobs currently being processed

**Key**: `bull:{queueName}:active`

**Type**: Redis LIST

**Contents**: Job IDs being actively processed by workers

---

### Completed Channel

**Purpose**: Successfully completed jobs

**Key**: `bull:{queueName}:completed`

**Type**: Redis SET

**TTL**: Auto-removed after 5 minutes

---

### Failed Channel

**Purpose**: Jobs that failed processing

**Key**: `bull:{queueName}:failed`

**Type**: Redis SET

**Contents**: Job IDs with error information

**TTL**: Auto-removed after 5 minutes

---

### ID Channel

**Purpose**: Job ID counter

**Key**: `bull:{queueName}:id`

**Type**: Redis STRING (integer counter)

**Usage**: Generates unique sequential IDs for each job

## Credential Storage Channels

Credentials are stored separately from job queues:

### Credential Pattern

```
sockethub:data-layer:credentials-store:{parentId}:{sessionId}:{credentialId}
```

### Example

```
sockethub:data-layer:credentials-store:sh-1a2b:abc123xyz:user@example.com:hash123
```

### Name Breakdown

| Component | Meaning | Example |
|-----------|---------|---------|
| **sockethub** | Process context | `sockethub` |
| **data-layer** | Package name | `data-layer` |
| **credentials-store** | Store type | `credentials-store` |
| **sh-1a2b** | Parent ID | Sockethub instance identifier |
| **abc123xyz** | Session identifier | `abc123xyz` |
| **<user@example.com>** | Actor ID (username) | `user@example.com` |
| **hash123** | Credential hash | Short hash of credential content |

### Security

- All credentials encrypted before storage
- Session-isolated (no cross-session access)
- Auto-deleted when session ends
- Encryption key unique per session

## Connection Naming

All Redis connections are named for debugging and monitoring:

### Connection Pattern

```
{logger-context}:{component}:{parentId}:{platformId}
```

### Examples

**Main Server - JobQueue**:

```
sockethub:data-layer:queue:sh-1a2b:irc-7f9c
```

**Platform Child - JobWorker**:

```
sockethub:platform:irc:worker789:data-layer:worker:sh-1a2b:irc-7f9c
```

**Credentials Store**:

```
sockethub:data-layer:credentials-store:sh-1a2b:abc123xyz
```

### Name Components

| Component | Origin | Purpose |
|-----------|--------|---------|
| **sockethub** | Logger context | Identifies this as Sockethub system |
| **platform:irc:worker789** | Logger context | Identifies specific platform child process |
| **data-layer** | Package namespace | Component package name |
| **queue/worker/credentials-store** | Component type | What this connection is used for |
| **sh-1a2b** | Parent ID | Which sockethub instance |
| **irc-7f9c** | Platform ID | Which platform instance |

## Session Isolation

Every Sockethub Client connection creates a completely isolated environment:

### Isolation Boundaries

**Unique Session ID**: 16-character random identifier generated per connection

**Isolated Queues**: Each platform instance has dedicated queue channels

- Instance A: `bull:sockethub-...-data-layer-queue-irc-...:*`
- Instance B: `bull:sockethub-...-data-layer-queue-irc-...:*`

**Isolated Credentials**: Each session has separate credential storage

- Session A: `sockethub:...:data-layer:credentials-store:...:sessionA:*`
- Session B: `sockethub:...:data-layer:credentials-store:...:sessionB:*`

**Isolated Processes**: For persistent platforms (IRC, XMPP), each actor gets a
dedicated platform child process

### Why Session Isolation Matters

- **Security**: No session can access another session's messages or credentials
- **Crash Isolation**: One session's platform crash doesn't affect other sessions
- **Memory Isolation**: Memory leaks in one session don't affect others
- **Clean Separation**: Each user's connections and data completely independent

### Session Lifecycle

**Creation**: When Sockethub Client connects

1. Generate unique session ID
2. Register the session with the platform instance
3. Spawn platform child processes when needed (for persistent platforms)
4. Establish encrypted communication channels

**Active**: During client connection

- All messages routed via platform-specific queues
- All credentials stored under session namespace
- Platform maintains active connections under platform context

**Cleanup**: When Sockethub Client disconnects

1. Session credentials deleted from Redis
2. Platform child processes terminated when no longer needed
3. Connections closed

## Cross-Process Communication

### Why Separate Processes?

Sockethub runs platforms in isolated child processes for resilience and security:

**Crash Isolation**: Platform code crash doesn't affect server or other platforms

**Memory Isolation**: Platform memory leaks contained to that process

**Security Boundaries**: Platform code runs in separate memory space

**Resource Limits**: Can enforce CPU/memory limits per platform

### The Context Problem

Different processes have different logger contexts:

**Main Server Process**:

- Context: `sockethub`
- Creates queue: `bull:sockethub-data-layer-queue-irc-session123:*`

**Platform Child Process**:

- Context: `sockethub:platform:irc:worker789`
- Tries to connect to queue with context included
- Results in different queue name

### The Solution

Queue names must be **context-independent** because the queue is a shared resource:

**What It Should Be**:

- Both processes use identifier: `data-layer-queue-irc-session123`
- Queue name: `bull:data-layer-queue-irc-session123:*`
- Both processes connect to same queue successfully

**Why It Matters**:

- Only the platform identifiers (platform + session) should determine queue name
- Process context (sockethub, sockethub:platform:irc:xyz) is process-local
- Queue is cross-process shared resource

## Performance Characteristics

### Per-Platform Resource Usage

**Single Platform Instance** (e.g., IRC for one actor):

- 1 JobQueue in main server
- 1 JobWorker in platform child
- 1 CredentialsStore (shared connection)
- Multiple BullMQ internal connections (~4-6 Redis connections total)

**Multiple Platform Instances** (1000 IRC actors):

- 1000 JobQueues
- 1000 JobWorkers
- 1 shared CredentialsStore connection
- ~4000-6000 total Redis connections

### Job Processing

**Asynchronous**: Server never blocks waiting for platform responses

**Reliable**: Jobs persist across crashes and restarts

**Ordered**: Jobs processed in first-in-first-out order per queue

**Retry Logic**: Failed jobs retry up to 3 times before permanent failure

**Automatic Cleanup**: Completed/failed jobs auto-removed after 5 minutes

### Connection Pooling

**CredentialsStore**: All instances share single Redis connection (pooled)

**BullMQ Connections**: Each Queue/Worker creates own connections (cannot be
pooled due to BullMQ architecture)

**Connection Naming**: All connections named with full component path for debugging

## Debugging Queue State

### Finding Queues

**List all queues**: Look for keys starting with `bull:`

**Filter by platform**: Find all IRC queues: `bull:*data-layer-queue-irc-*`

**Filter by parentId**: Find a sockethub instance: `bull:*sh-1a2b*`

### Understanding Queue Contents

**Meta channel**: Configuration and queue state

**Wait channel**: Jobs waiting to be processed (normal backlog)

**Active channel**: Jobs currently being processed (should be small)

**Completed channel**: Recently successful jobs (auto-cleanup after 5 minutes)

**Failed channel**: Recently failed jobs with error details

### Connection Monitoring

**List all connections**: See all active Redis connections with names

**Filter by component**: Find all queue connections, worker connections, or credential connections

**Identify processes**: Connection names show which process (main vs platform child)

## Security Model

### Encryption at Rest

**Session Secret**: Unique 32-character encryption key per session

**Encrypted Job Data**: All ActivityStreams messages encrypted before queuing

**Encrypted Credentials**: All credentials encrypted in Redis

**No Plaintext**: Sensitive data never stored unencrypted

### Isolation Guarantees

**Process Isolation**: Platform code runs in separate memory space from server

**Session Isolation**: No session can access another session's queues or credentials

**Queue Isolation**: Each session has dedicated queue channels

**Credential Scoping**: Each platform only accesses its own credentials per session

### Data Lifetime

**In-Flight Jobs**: Exist only during active processing

**Completed Jobs**: Auto-deleted after 5 minutes

**Session Data**: Immediately deleted on client disconnect

**Credentials**: Deleted when session ends

## Common Scenarios

### Normal Message Flow

1. Sockethub Client sends ActivityStreams message
2. Server validates and encrypts message
3. Server adds encrypted job to session's queue wait channel
4. Worker pulls job from wait channel to active channel
5. Worker decrypts and processes message
6. Worker marks job complete, moves to completed channel
7. Server notifies client of success
8. Job auto-deleted from completed channel after 5 minutes

### Failed Job Handling

1. Worker tries to process job but fails
2. Job marked failed and moved to failed channel
3. BullMQ retry logic attempts up to 3 times
4. If all retries fail, job permanently moved to failed channel
5. Server notifies client of error
6. Failed job auto-deleted after 5 minutes

### Session Cleanup

1. Sockethub Client disconnects (or connection lost)
2. Server detects disconnect event
3. All jobs in session queues cleared (wait, active, completed, failed)
4. All session credentials deleted from Redis
5. Platform child process terminated
6. All Redis keys with session ID deleted
7. All connections closed

### Platform Crash Recovery

1. Platform child process crashes during job processing
2. Job remains in active channel (marked as "stalled")
3. BullMQ detects stalled job after timeout
4. Job moved back to wait channel for retry
5. Server spawns new platform child process
6. New worker picks up stalled job and reprocesses
7. Client receives result (transparent to user)

## Related Documentation

- [Architecture Overview](./architecture.md) - High-level system architecture and design decisions
- [Platform Development](./platform-development.md) - Creating custom platforms
- [Configuration Guide](./configuration.md) - Redis and queue configuration options
