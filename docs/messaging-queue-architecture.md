# Messaging Queue Architecture

This document is a quick refresher on how Sockethub names queues and routes
messages across processes while keeping payloads encrypted.

## Naming Summary

| Placeholder | Meaning |
|-----------|---------|
| `parentId` | Sockethub instance identifier generated at boot |
| `platformId` | Hash of platform name, or platform+actor for persistent platforms |
| `sessionId` | Client session identifier (Socket.IO connection id) |
| `credentialId` | Derived from the credential payload (hashed) |

## Canonical Namespace

Sockethub uses one logical naming scheme for all Redis identifiers:

`sockethub:{parentId}:data-layer:{component}:{id...}`

- For queues, the canonical ID is
  `sockethub:{parentId}:data-layer:queue:{platformId}`.
- For credentials, the canonical ID is
  `sockethub:{parentId}:data-layer:credentials-store:{sessionId}:{credentialId}`.

**BullMQ note**: BullMQ queue names cannot contain colons, so we convert the
canonical queue ID by replacing `:` with `-` when constructing the BullMQ queue
name. The *order and meaning* remain the same.

## Queue Naming (Redis)

Canonical queue ID:
`sockethub:{parentId}:data-layer:queue:{platformId}`

BullMQ queue name:
`bull:sockethub-{parentId}-data-layer-queue-{platformId}`

## Credential Storage (Redis)

Credential keys are session‑isolated and separate from queues:
`sockethub:{parentId}:data-layer:credentials-store:{sessionId}:{credentialId}`

## Routing (Client -> Platform)

Think of the queue ID as the shared “mailbox” both processes agree on.

- Client sends ActivityStreams to the server over Socket.IO.
- Server validates, encrypts with the session secret, and enqueues to the queue
  identified by `sockethub:{parentId}:data-layer:queue:{platformId}`.
- Worker listens on that same queue ID, decrypts with the session secret, and
  processes the platform request.
- Server routes results back using the `sessionId` carried in the job payload.

## Routing (Platform -> Client)

Incoming platform events bypass Redis for latency:
Platform -> IPC -> Server -> Client

## Session Isolation

- Credentials are isolated per session.
- Queues are isolated per platform instance.
- Platform workers are isolated per actor for persistent platforms.
