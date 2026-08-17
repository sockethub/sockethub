# Security Audit Findings — Sockethub Codebase

**Date:** 2026-08-17
**Scope:** API security, logic flaws, race conditions across the monorepo
**Exclusions:** Previously known findings (credential-check bypass, job response
interception via message ID collision, HTTP idempotency cache storing credentials
in plaintext, unauthenticated child process fork bomb, IRC/XMPP SSRF bypass)

---

## Finding 1: Client IP Spoofing via Proxy Header Bypass (Credential-Check & Rate Limiting)

**Files:**
- `packages/server/src/sockethub.ts` lines 60–83
- `packages/server/src/middleware/credential-check.ts` lines 111–142

**Vulnerability type:** Business logic bypass / IP spoofing

**Description:**
When `credentialCheck.reconnectIpSource` is set to `"proxy"`, the server reads
the client IP from a configurable HTTP header (`x-forwarded-for` by default).
This header is trusted without any upstream validation beyond a log warning at
startup. If the server is deployed without a trusted reverse proxy that overwrites
this header (or if the proxy passes through client-supplied values), an attacker
can forge arbitrary IP addresses.

**Attack chain:**
1. Attacker opens a Socket.IO connection and sets the `X-Forwarded-For` header to
   an IP address matching a victim's existing session.
2. The `getClientIp()` function returns the spoofed IP.
3. In `credential-check.ts`, the `canReconnectFromSameIp()` function compares the
   new socket's IP against existing sessions' stored IPs.
4. If all prior sessions for a platform instance are stale and the IPs match, the
   attacker bypasses the `CredentialsNotShareableError` rejection.
5. The attacker attaches to an existing platform instance (e.g. an IRC session) as
   an anonymous user without providing credentials.

Additionally, the `socketsPerIp` connection cap in `claimIpSlot()` is also keyed
by this same spoofable IP. An attacker can bypass the per-IP connection limit or
make it apply to a victim by using their IP in the header.

**Evidence:**
```typescript
// sockethub.ts:66-69 — unconditional trust of header value
if (ipSource === "proxy") {
    const proxyHeader = getProxyHeaderName();
    const headerValue = socket.handshake.headers[proxyHeader];
```

**Mitigating controls:**
- The config option defaults to `"socket"` (safe), and a startup warning is logged.
- The config documentation says to only use this behind a trusted proxy.
- The anonymous reconnect path still requires all prior sessions to be stale.

**Severity:** Medium (requires misconfiguration, but the misconfiguration is a
supported feature)

---

## Finding 2: Cross-Session Data Leakage via `broadcastToSharedPeers`

**Files:**
- `packages/server/src/platform-instance.ts` lines 392–399, 452–456

**Vulnerability type:** Cross-session data leakage / Excessive data exposure

**Description:**
When a job completes or fails on a shared platform instance (persistent platforms
where multiple sockets share an actor), `handleJobResult()` calls
`broadcastToSharedPeers()` which sends the **full job result payload** — including
the original `job.msg` on failures — to every peer session attached to the same
platform instance. While `toExternalPayload()` strips `sessionSecret`, the
original message (which initiated the job) is broadcast to all peers on failure.

**Attack chain:**
1. Two users (Alice and Bob) share a persistent platform instance for the same
   actor (e.g. shared IRC bot account).
2. Alice sends a message that includes user-specific content in the `object` field.
3. The job fails.
4. On failure, `handleJobResult` sets `payload = job.msg` (Alice's original
   request including her `object` data).
5. `broadcastToSharedPeers` sends this payload to Bob's socket.
6. Bob receives Alice's message content.

**Evidence:**
```typescript
// platform-instance.ts:428-429
if (state === "failed") {
    payload = job.msg; // failures always use original AS job object
// ...
// platform-instance.ts:452-456
if (payload) {
    this.broadcastToSharedPeers(job.sessionId, payload);
}
```

**Mitigating controls:**
- `toExternalPayload()` strips `sessionSecret` before broadcast.
- In practice, shared instances are per-actor, so peers are typically the same
  user on different browser tabs.
- The broadcast is likely intentional for multi-device awareness, but it leaks
  the full request on failures including object content.

**Severity:** Low–Medium (depends on whether different users genuinely share a
persistent actor, which the credential-check middleware tries to restrict)

---

## Finding 3: Static Resource Route Allows Undefined Path Lookup

**Files:**
- `packages/server/src/routes.ts` lines 44–48

**Vulnerability type:** Missing input validation / Potential undefined sendFile

**Description:**
The `prepFileRoutes()` function registers Express GET routes for a fixed set of
paths, but the handler uses `req.url` to look up the file path from `pathMap`.
Express's `req.url` can differ from the route's `path` (e.g. it may include
query strings, or if the route is mounted on a sub-router). If `req.url` doesn't
exactly match a key in `pathMap`, the lookup returns `undefined`, and
`res.sendFile(undefined)` will throw a TypeError.

```typescript
route: (req: Request, res: Response) => {
    logger.debug(`serving resource ${req.url}`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(pathMap[req.url]);  // req.url may include query string
},
```

**Attack chain:**
1. Attacker requests `/sockethub-client.js?foo=bar`.
2. `req.url` is `/sockethub-client.js?foo=bar`, which is not a key in `pathMap`.
3. `pathMap[req.url]` returns `undefined`.
4. `res.sendFile(undefined)` throws a TypeError. Express's default error handler
   catches it and returns a 500 response. In development mode, Express may include
   the stack trace.

**Evidence:**
The routes are registered via `app.get(route.meta.path, route.route)` where
`route.meta.path` is e.g. `"/sockethub-client.js"`. Express matches the path
ignoring query strings, but `req.url` includes the full URL with query strings.

**Mitigating controls:**
- The `pathMap` keys are a small whitelist, so this only causes a crash/500, not
  a path traversal.
- Express catches the error (no process crash).
- The hardcoded `Access-Control-Allow-Origin: *` header on these routes is
  intentional (they serve public client libraries).

**Severity:** Low (information disclosure via error messages, minor DoS)

---

## Finding 4: Actor/Target Object Types Allow `additionalProperties`

**Files:**
- `packages/schemas/src/helpers/objects.ts` lines 8, 34, 50, 66, 82, 98, 125

**Vulnerability type:** Mass assignment / Schema permissiveness

**Description:**
Most actor and target object type definitions in the schema set
`additionalProperties: true`, meaning clients can include arbitrary extra fields
in actor/target objects. While the top-level ActivityStream schema has
`additionalProperties: false`, the sub-schemas for actor and target do not
restrict extra properties.

These extra properties are carried through the entire pipeline — stored in Redis
(encrypted), sent to platform child processes, and potentially broadcast back to
clients (including shared peers).

**Attack chain:**
1. Attacker sends a message with an actor object containing extra fields:
   ```json
   {
     "actor": {
       "id": "user@example.com",
       "type": "person",
       "name": "user",
       "__proto__": { "isAdmin": true },
       "internalFlag": "escalate"
     }
   }
   ```
2. These fields pass schema validation (additionalProperties is true for person).
3. The fields travel through the job queue into the platform child process.
4. If a platform implementation uses `Object.assign()` or spread operators to
   merge actor data with internal objects, prototype pollution or field injection
   could occur.
5. On shared instances, extra fields are broadcast to all peers.

**Evidence:**
```typescript
// objects.ts — person type
person: {
    required: ["id", "type"],
    additionalProperties: true,  // allows arbitrary extra fields
    properties: { ... }
},
```

**Mitigating controls:**
- The top-level ActivityStream schema blocks unknown top-level properties.
- Job data is encrypted in Redis, so the fields aren't readable at rest.
- `toExternalPayload()` only strips `sessionSecret` and `context`, not arbitrary
  injected fields.

**Severity:** Medium (depends on platform implementations; no known exploitation
in built-in platforms but creates risk for third-party platforms)

---

## Finding 5: Rate Limiter Keyed by Socket ID — Reconnection Bypass

**Files:**
- `packages/server/src/rate-limiter.ts` lines 75–141
- `packages/server/src/sockethub.ts` lines 246–273

**Vulnerability type:** Rate limiting gap / Business logic bypass

**Description:**
The Socket.IO event rate limiter is keyed by `socket.id`. When a client
disconnects and reconnects, it gets a new `socket.id`, and the old rate limit
state is cleaned up (`cleanupClient`). The `maxConnectionsPerIp` cap mitigates
opening *concurrent* sockets, but an attacker can cycle connections serially
(disconnect + reconnect) to reset the rate limiter's window and block state.

**Attack chain:**
1. Attacker opens a Socket.IO connection and sends messages at the rate limit.
2. When rate-limited (blocked for `blockDurationMs`), the attacker disconnects.
3. The disconnect triggers `cleanupClient(socket.id)`, which deletes the
   rate limit state.
4. The attacker reconnects immediately, receiving a new `socket.id`.
5. A new `ClientState` is created with `count: 0` and no block.
6. The attacker resumes sending at the burst limit. Repeat.

**Evidence:**
```typescript
// rate-limiter.ts:144-146
export function cleanupClient(socketId: string) {
    clientStates.delete(socketId);  // wipes all rate limit state
}
// sockethub.ts:353
cleanupClient(socket.id);  // called on disconnect
```

The `maxConnectionsPerIp` cap prevents simultaneous sockets but does not prevent
serial reconnection cycling (1 connection at a time, reconnecting to reset).

**Mitigating controls:**
- `maxConnectionsPerIp` (default 20) limits concurrent connections.
- Socket.IO has connection-level overhead that naturally limits reconnect rate.
- The HTTP actions path uses `express-rate-limit` keyed by IP, which is more
  robust.

**Severity:** Medium (allows sustained high-volume message sending that bypasses
the intended rate limit by cycling connections)

---

## Finding 6: Uncapped `object` Property Size in ActivityStream Schema

**Files:**
- `packages/schemas/src/schemas/activity-stream.ts` lines 58–63
- `packages/server/src/listener.ts` lines 46–54

**Vulnerability type:** Resource exhaustion / DoS

**Description:**
The ActivityStream schema validates `object` only as `{ type: "object" }` with no
`maxProperties`, `maxLength` on string values, or depth limits. The Socket.IO
`maxHttpBufferSize` (default 256KB) limits individual message size, but an
attacker can send many messages each containing large deeply-nested `object`
payloads that individually fit within the buffer limit.

These objects are:
1. Serialized to JSON for encryption (CPU cost)
2. Encrypted with AES (CPU cost)
3. Stored in Redis via BullMQ (memory cost)
4. Decrypted in the child process (CPU cost)
5. Passed to the platform handler (memory cost)
6. On completion/failure, potentially broadcast to all peers (bandwidth cost)

**Attack chain:**
1. Attacker sends many messages with maximally-sized `object` payloads (each
   ~256KB, the Socket.IO limit).
2. Each message passes schema validation (object type is not deeply validated
   at the envelope level).
3. Messages queue up in Redis, consuming memory.
4. Platform workers decrypt and process them, consuming CPU.
5. For persistent platforms, all results are broadcast to peers.

**Mitigating controls:**
- `maxPayloadBytes` (256KB default) caps individual message size.
- The rate limiter (100 messages/second) provides some throttling.
- Per-platform `messages` schemas may impose stricter object validation.
- BullMQ job auto-removal (5-minute age) limits Redis buildup.

**Severity:** Low–Medium (bounded by existing controls but creates amplification
through the encrypt/store/decrypt/broadcast pipeline)

---

## Finding 7: Error Messages Expose Internal Platform State

**Files:**
- `packages/server/src/platform-instance.ts` lines 557–573
- `packages/server/src/middleware/validate.ts` lines 70, 82, 107–109
- `packages/server/src/platform.ts` lines 260–264, 268–272

**Vulnerability type:** Information disclosure via error messages

**Description:**
Several error paths expose internal state to clients:

1. **Process close events** broadcast `"Error: session thread closed
   unexpectedly: <error>"` to all sessions, where `<error>` may contain internal
   process information (exit codes, signal names, etc.).

2. **Validation errors** disclose which platforms are registered and their
   supported types: `"platform type ${stream.type} not supported by ${platformId}
   platform. (types: ${platformMeta.types.join(", ")})"` — this enumerates the
   platform's type vocabulary to any unauthenticated client.

3. **Platform child process exceptions** send `err.toString()` over IPC to the
   parent, which broadcasts it to all connected sessions. Stack traces are logged
   to console but `err.toString()` may still contain file paths or internal class
   names.

**Attack chain:**
1. Attacker sends messages targeting various `@context` values.
2. Error responses reveal which platforms are registered, their supported types,
   and their context URLs.
3. Attacker sends malformed messages to trigger platform errors.
4. Error broadcasts include internal error messages that may reveal
   implementation details (library names, connection strings, etc.).

**Evidence:**
```typescript
// validate.ts:104-109
if (!platformMeta.types.includes(stream.type)) {
    return done(
        new Error(
            `platform type ${stream.type} not supported by ${platformId} ` +
            `platform. (types: ${platformMeta.types.join(", ")})`));
}
```

**Mitigating controls:**
- The `schemas` event already exposes the full platform registry to connected
  clients (by design), so type enumeration adds limited extra exposure.
- `toExternalPayload()` strips internal transport fields.
- `attachError()` in `message-handlers.ts` strips `sessionSecret` from error
  responses.

**Severity:** Low (most information is already available through the schemas
event, but uncontrolled error messages from platforms could leak sensitive data)

---

## Finding 8: HTTP Actions Session Credentials Persist During Timeout Window

**Files:**
- `packages/server/src/http/actions.ts` lines 732–755, 859–889

**Vulnerability type:** TOCTOU / credential lifecycle gap

**Description:**
HTTP actions requests create a per-request `CredentialsStore` and call
`credentialsStore.teardown()` in the `cleanup()` function, which runs when all
jobs complete or a timeout fires. However, between credential storage (via the
`credentials` handler) and cleanup, the credentials exist in Redis under a
session ID with the prefix `http:`.

If a request times out (`requestTimeoutMs` default 30s or `idleTimeoutMs` default
15s), `completeRequest()` is called, which eventually calls `cleanup()`. But if
platform jobs are still running (queued in BullMQ), they may attempt to read
credentials after teardown.

More critically, the credential TTL (`credentials.ttlMs` default 604800000 =
7 days) means that if `teardown()` fails or is never called (e.g. process crash
mid-request), the encrypted credential key persists in Redis for up to 7 days.

**Attack chain:**
1. Attacker sends an HTTP actions request with credentials.
2. Credentials are stored in Redis with a 7-day sliding TTL.
3. Before teardown runs, the process crashes or the Redis operation fails.
4. The credential key remains in Redis for up to 7 days.
5. Anyone with access to Redis can see the encrypted credential blob (though
   decryption requires the per-session secret, which is only in process memory).

**Mitigating controls:**
- Credentials are AES-encrypted at rest (the `SecureStore` layer).
- The session secret needed for decryption is ephemeral (in-memory only).
- `purgeCredentialsStores()` is called during graceful shutdown.
- The TTL is a backstop, not the primary cleanup mechanism.

**Severity:** Low (encrypted at rest, key is ephemeral, but stale keys
accumulate if crashes are frequent)

---

## Finding 9: `schemas` Event Exposes Full Platform Registry Without Authentication

**Files:**
- `packages/server/src/sockethub.ts` lines 113–135, 325–341

**Vulnerability type:** Excessive data exposure / Reconnaissance

**Description:**
The `schemas` Socket.IO event is handled for every connected socket without any
authentication check. Any client that opens a Socket.IO connection receives the
full platform registry including: all registered platforms, their versions,
context URLs, context versions, schema versions, credential schemas, and message
schemas.

This includes the credential schema definitions which reveal exactly what fields
each platform's credentials accept (e.g., server hostnames, port fields, OAuth
token fields, etc.).

**Attack chain:**
1. Attacker connects to the Socket.IO endpoint (no auth required).
2. Attacker emits `"schemas"`.
3. Server responds with the full platform registry.
4. Attacker uses credential schemas to understand exactly what credential fields
   are expected for each platform.
5. This information aids in crafting targeted attacks against specific platforms.

**Evidence:**
```typescript
// sockethub.ts:325-341 — no authentication check
socket.on("schemas", (...args: unknown[]) => {
    // ...
    const response = clientFingerprint === fingerprint
        ? { fingerprint, unchanged: true }
        : platformRegistryPayload;
    // ...
});
```

**Mitigating controls:**
- Platform schemas are generally considered public information (open-source
  platform packages).
- The CORS policy can restrict which origins can connect.
- This is by design for the client library handshake.

**Severity:** Low (by design, but worth noting for deployments that consider
their platform configuration sensitive)

---

## Summary Table

| # | Finding | Type | Severity | File(s) |
|---|---------|------|----------|---------|
| 1 | Client IP spoofing via proxy header | Logic bypass | Medium | `sockethub.ts`, `credential-check.ts` |
| 2 | Cross-session data leakage via broadcast | Data leakage | Low–Medium | `platform-instance.ts` |
| 3 | Static route undefined path lookup | Input validation | Low | `routes.ts` |
| 4 | Actor/target additionalProperties:true | Mass assignment | Medium | `objects.ts` |
| 5 | Rate limiter bypass via reconnection | Rate limiting gap | Medium | `rate-limiter.ts`, `sockethub.ts` |
| 6 | Uncapped object property size | Resource exhaustion | Low–Medium | `activity-stream.ts`, `listener.ts` |
| 7 | Error messages expose internal state | Info disclosure | Low | `platform-instance.ts`, `validate.ts` |
| 8 | HTTP actions credential persistence | Credential lifecycle | Low | `http/actions.ts` |
| 9 | Unauthenticated schema exposure | Data exposure | Low | `sockethub.ts` |
