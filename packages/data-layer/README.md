# @sockethub/data-layer

Redis-based data storage and job queue infrastructure for Sockethub, providing reliable message processing and secure credential storage.

## About

The data layer package provides the core infrastructure components that enable Sockethub's distributed architecture:

- **Job Queue System**: Redis-backed message queuing using BullMQ for reliable ActivityStreams processing
- **Credentials Store**: Encrypted storage for user credentials and authentication data
- **Session Management**: Per-client data isolation and security
- **Redis Integration**: Connection management and health checking

## Core Components

### JobQueue & JobWorker

Handles asynchronous message processing between Sockethub server and platform instances. The JobQueue manages job creation and queuing on the server side, while JobWorker processes jobs within platform child processes.

### CredentialsStore

Provides secure, encrypted storage for user credentials with automatic encryption/decryption and session-based isolation.

## Key Features

### Security

- **End-to-end encryption** of all stored data using AES-256
- **Session-based isolation** prevents credential cross-contamination
- **Secure key management** with per-session secrets
- **No plaintext storage** in Redis or logs

### Reliability

- **Message persistence** ensures no data loss during processing
- **Automatic retries** for failed operations
- **Connection pooling** with Redis for efficiency
- **Graceful error handling** and recovery

### Scalability

- **Horizontal scaling** across multiple server instances
- **Per-session queues** for natural load distribution
- **Process isolation** for platform-specific processing
- **Redis clustering** support for high availability

## Configuration

**Redis Configuration**: Requires a Redis URL in the format `redis://host:port` or `redis://user:pass@host:port`

**Dependencies:**
- Redis server (6.0+)
- `@sockethub/crypto` for encryption
- `@sockethub/schemas` for type definitions

## API Documentation

For detailed API documentation including method signatures, parameters, and examples, generate the API docs from JSDoc comments:

```bash
bun run doc
```

## Architecture Integration

The data layer sits between Sockethub's main server and platform instances:

```
[Sockethub Server] ←→ [Data Layer] ←→ [Platform Instances]
       ↑                   ↑                   ↑
   Socket.IO          Redis Storage      Protocol Logic
   Connections        Job Queues         (IRC, XMPP, etc.)
```

**Server Integration**: Creates job queues and credential stores per client session

**Platform Integration**: Workers process jobs and access stored credentials securely

**Redis Storage**: Centralized, persistent storage for all data layer operations

## Error Handling

The data layer provides comprehensive error handling:

- **Connection failures**: Automatic retry with exponential backoff
- **Encryption errors**: Clear error messages for key management issues  
- **Job failures**: Failed jobs are logged and can be retried
- **Resource cleanup**: Proper shutdown procedures prevent memory leaks

## Performance Considerations

**Memory Management:**
- Completed jobs are automatically cleaned up
- Connection pooling minimizes resource usage
- Per-session isolation prevents memory leaks

**Network Efficiency:**
- Redis pipelining for batch operations
- Compressed job payloads for large messages
- Keep-alive connections reduce overhead

## Related Documentation

- [Main Sockethub README](../../README.md) - Overall project documentation
- [Queue System Architecture](QUEUE.md) - Overview of the Queue system
