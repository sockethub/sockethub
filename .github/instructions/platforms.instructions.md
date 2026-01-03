---
applyTo:
  - "packages/platform-*/**/*.ts"
---

# Platform Development Instructions

These instructions apply to all platform packages (`packages/platform-*/`).

## Platform Interface Contract

Every platform MUST implement the `PlatformInterface` from `@sockethub/schemas`:

```typescript
export default class MyPlatform implements PlatformInterface {
  debug: Logger;
  credentialsHash: string;
  config: PlatformConfig;

  constructor(session: PlatformSession) {
    this.debug = session.debug;
    this.sendToClient = session.sendToClient;
    this.updateActor = session.updateActor;
  }

  get schema(): PlatformSchemaStruct {
    return MyPlatformSchema;
  }
}
```

**Flag violations of this contract with HIGH confidence.**

## Schema Definition

Every platform MUST export a schema with:

```typescript
export const PlatformMySchema = {
  name: "myplatform",      // MUST match package name suffix
  version: version,         // MUST come from package.json
  messages: {
    required: ["type"],
    properties: {
      type: {
        enum: ["connect", "send", "..."] // Supported message types
      }
    }
  },
  credentials: {
    required: ["object"],
    properties: {
      object: {
        type: "object",
        required: [...],      // Platform-specific credential fields
        properties: { ... }
      }
    }
  }
};
```

**Common issues to flag:**
- Schema name doesn't match platform name
- Missing version field
- Credentials schema missing required fields
- Message types not enumerated

## Configuration Patterns

Platforms use one of two config patterns:

### Persistent Platforms (stateful connections)
```typescript
config: PersistentPlatformConfig = {
  persist: true,
  requireCredentials: ["connect", "update"], // Verbs requiring credentials
  initialized: false,
  connectTimeoutMs: 30000
};
```

### Stateless Platforms (no connection state)
```typescript
config: StatelessPlatformConfig = {
  persist: false,
  requireCredentials: ["send"] // Optional
};
```

**Flag if:**
- Persistent platform doesn't set `requireCredentials`
- Timeout is unreasonably short (<5000ms) or long (>120000ms)
- Platform manages connections but uses `persist: false`

## Credential Handling

Credentials come pre-validated and encrypted. Platforms receive them decrypted:

```typescript
// CORRECT - credentials already validated by schema
connect(job: ActivityStream, credentials: MyCredentialsType, done: PlatformCallback) {
  const { server, username, password } = credentials.object;
  // Use credentials directly
}

// WRONG - don't re-validate or decrypt
connect(job: ActivityStream, credentials: any, done: PlatformCallback) {
  if (!credentials.object || !credentials.object.server) {
    return done("Missing server"); // Schema handles this
  }
}
```

**Flag if:**
- Platform validates fields already in schema
- Platform attempts decryption (credentials arrive decrypted)
- Platform logs credential values

## Client Connection Management

Persistent platforms MUST manage client lifecycle:

```typescript
class MyPlatform {
  private client: ProtocolClient;
  private clientConnecting = false;

  // Pattern: Single client instance per actor
  private getClient(
    actorId: string,
    credentials: Credentials | false,
    callback: GetClientCallback
  ) {
    if (this.client) {
      return callback(null, this.client); // Reuse existing
    }

    if (this.clientConnecting) {
      // Wait for in-progress connection
      return this.onClientConnect = callback;
    }

    if (!credentials) {
      return callback("No credentials available");
    }

    this.clientConnecting = true;
    this.establishConnection(credentials, callback);
  }
}
```

**Flag if:**
- Creating multiple client instances per actor (memory leak)
- Not tracking connection state (race conditions)
- Not reusing existing connections

## Error Handling

Protocol operations can fail in many ways. Handle ALL error cases:

```typescript
// CORRECT - comprehensive error handling
async send(job: ActivityStream, done: PlatformCallback) {
  this.getClient(job.actor.id, false, (err, client) => {
    if (err) {
      return done(err); // Connection error
    }

    client.send(message, (sendErr) => {
      if (sendErr) {
        this.debug(`Send failed: ${sendErr.message}`);
        return done(sendErr); // Protocol error
      }
      done(); // Success
    });
  });
}

// WRONG - missing error handling
async send(job: ActivityStream, done: PlatformCallback) {
  const client = await this.getClient(job.actor.id);
  client.send(message); // What if this fails?
  done();
}
```

**Error handling requirements:**
- ALWAYS call `done(err)` on failure
- NEVER silently swallow protocol errors
- Log errors with context (actor ID, action)
- Handle network timeouts explicitly

## Message Translation

Platforms translate between protocol messages and ActivityStreams:

```typescript
// Incoming protocol message → ActivityStream → sendToClient
client.on("message", (protocolMsg) => {
  const activityStream: ActivityStream = {
    context: this.schema.name,
    type: "send",
    actor: { id: protocolMsg.from },
    object: {
      type: "message",
      content: protocolMsg.text
    }
  };
  this.sendToClient(activityStream);
});

// ActivityStream → protocol message → send
send(job: ActivityStream, done: PlatformCallback) {
  const protocolMsg = {
    to: job.target.id,
    text: job.object.content
  };
  this.client.send(protocolMsg, done);
}
```

**Flag if:**
- Protocol-specific objects leak into ActivityStreams
- Missing required ActivityStream fields (`context`, `type`, `actor`)
- Not using `sendToClient` for incoming messages

## Cleanup and Disconnect

Platforms MUST clean up resources on disconnect:

```typescript
disconnect(job: ActivityStream, done: PlatformCallback) {
  this.debug("Disconnecting...");
  this.forceDisconnect = true; // Prevent reconnect

  if (!this.client) {
    return done(); // Already disconnected
  }

  this.client.disconnect(() => {
    this.client = null; // Release connection
    this.clientConnecting = false;
    this.jobQueue = []; // Clear pending jobs
    done();
  });
}
```

**Flag if:**
- Not setting client to null (memory leak)
- Not clearing event listeners (memory leak)
- Not clearing job queues or timers
- Disconnect callback never called

## Testing Requirements

Platform tests MUST cover:

1. **Connection success and failure**
2. **Each message type** (send, join, etc.)
3. **Credential validation** (via schema)
4. **Error handling** (network errors, protocol errors)
5. **Message translation** (both directions)

```typescript
describe("MyPlatform", () => {
  test("connects with valid credentials", async () => {
    // Test connection
  });

  test("handles connection timeout", async () => {
    // Test error case
  });

  test("translates protocol messages to ActivityStreams", () => {
    // Test incoming message translation
  });
});
```

## Common Anti-Patterns to Flag

1. **Storing credentials** - Server handles this, platforms receive as needed
2. **Creating new debug instances** - Use `this.debug` from session
3. **Direct Socket.IO imports** - Use `this.sendToClient` instead
4. **Blocking operations** - All I/O must be async with callbacks/promises
5. **process.exit() without cleanup** - Clean up connections first

## Platform-Specific Packages

Some platforms use helper packages:

- `@sockethub/irc2as` - IRC to ActivityStreams conversion
- Platform-specific protocol libraries (e.g., `irc-socket-sasl`)

When these exist, USE them instead of reimplementing message translation.
