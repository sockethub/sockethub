# API Documentation

This package provides the data layer for Sockethub, including job queue management and secure credential storage.

## Main Classes

### JobQueue
Redis-backed job queue for managing ActivityStreams message processing. Creates isolated queues per platform instance and session, providing reliable message delivery and processing coordination between Sockethub server and platform workers.

### JobWorker  
Worker for processing jobs from a Redis queue within platform child processes. Connects to the same queue as its corresponding JobQueue instance and processes jobs using a platform-specific handler function.

### CredentialsStore
Secure, encrypted storage for user credentials with session-based isolation. Provides automatic encryption/decryption of credential objects stored in Redis, ensuring that sensitive authentication data is never stored in plaintext.

## Complete API Reference

For detailed API documentation including method signatures, parameters, and examples, see the [generated TypeDoc documentation](./docs/index.html).

## Related Documentation

- [Queue Architecture](./QUEUE.md) - Conceptual overview of the queueing system
- [Main Sockethub Documentation](https://github.com/sockethub/sockethub)