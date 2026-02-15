# Configuration

Sockethub configuration options for different deployment scenarios.

## Configuration File

Sockethub uses a JSON configuration file:

- Development: `sockethub.config.json` in current working directory
- Production: Specify via `--config` flag or `SOCKETHUB_CONFIG` environment variable

### Default Configuration Structure

```json
{
  "$schema": "https://sockethub.org/schemas/3.0.0-alpha.4/sockethub-config.json",
  "examples": true,
  "logging": {
    "level": "info",
    "fileLevel": "debug",
    "file": "sockethub.log"
  },
  "packageConfig": {
    "@sockethub/activity-streams": {
      "specialObjs": ["credentials"],
      "failOnUnknownObjectProperties": true
    }
  },
  "platforms": [
    "@sockethub/platform-dummy",
    "@sockethub/platform-feeds",
    "@sockethub/platform-irc", 
    "@sockethub/platform-metadata",
    "@sockethub/platform-xmpp"
  ],
  "public": {
    "protocol": "http",
    "host": "localhost",
    "port": 10550,
    "path": "/"
  },
  "rateLimiter": {
    "windowMs": 1000,
    "maxRequests": 100,
    "blockDurationMs": 5000
  },
  "redis": {
    "url": "redis://127.0.0.1:6379"
  },
  "sentry": {
    "dsn": "",
    "traceSampleRate": 1.0
  },
  "sockethub": {
    "port": 10550,
    "host": "localhost", 
    "path": "/sockethub"
  },
  "httpActions": {
    "enabled": false,
    "path": "/sockethub-http",
    "requireRequestId": true,
    "maxMessagesPerRequest": 20,
    "maxPayloadBytes": 262144,
    "idempotencyTtlMs": 300000,
    "requestTimeoutMs": 30000,
    "idleTimeoutMs": 15000
  }
}
```

## Configuration Sections

### Server Settings

```json
{
  "sockethub": {
    "port": 10550,          // Port Sockethub listens on
    "host": "localhost",    // Bind address
    "path": "/sockethub"    // WebSocket endpoint path
  }
}
```

### Public Settings

For client connections and reverse proxy setups:

```json
{
  "public": {
    "protocol": "https",              // http or https
    "host": "sockethub.example.com",  // Public hostname
    "port": 443,                      // Public port
    "path": "/"                       // Public path prefix
  }
}
```

### Platform Management

Platforms are specified as an array of package names:

```json
{
  "platforms": [
    "@sockethub/platform-dummy",
    "@sockethub/platform-feeds",
    "@sockethub/platform-irc",
    "@sockethub/platform-metadata",
    "@sockethub/platform-xmpp"
  ]
}
```

To disable a platform, remove it from the array.

### Rate Limiting

Protect against event flooding from individual clients:

```json
{
  "rateLimiter": {
    "windowMs": 1000,          // Time window in milliseconds
    "maxRequests": 100,        // Max events per window per client
    "blockDurationMs": 5000    // Block duration after exceeding limit
  }
}
```

**Default limits:** 100 events per second per client, 5 second block.

The rate limiter operates per WebSocket connection and blocks clients that exceed the configured
thresholds. Blocked clients are automatically unblocked after the `blockDurationMs` expires.

### HTTP Actions

HTTP actions provide a one-shot HTTP interface for sending ActivityStreams
messages without opening a WebSocket connection.

This does **not** introduce a second platform execution path. After the HTTP
request is parsed, each message goes through the same core routing pipeline:

1. ActivityStreams validation middleware
2. credential storage middleware (when sending credentials)
3. Redis-backed job queue
4. platform child process execution
5. queue completion callback back to the caller

The only differences from WebSocket transport are:

- input/output transport (`POST` + streaming `NDJSON`)
- optional idempotent replay (`requestId` + `GET`)
- no long-lived socket session

Stateless platform session behavior is unchanged. Session lifecycle tracking is
only used for persistent platforms that need it.

```json
{
  "httpActions": {
    "enabled": true,
    "path": "/sockethub-http",
    "requireRequestId": true,
    "maxMessagesPerRequest": 20,
    "maxPayloadBytes": 262144,
    "idempotencyTtlMs": 300000,
    "requestTimeoutMs": 30000,
    "idleTimeoutMs": 15000
  }
}
```

Configuration behavior:

- `enabled`: turns HTTP actions on/off.
- `path`: route path for `POST` and `GET`.
- `requireRequestId`: if `true`, caller must provide a request id.
- `maxMessagesPerRequest`: maximum message count in one HTTP request.
- `maxPayloadBytes`: JSON body size limit enforced by Express body parser.
- `idempotencyTtlMs`: how long replay data is kept in Redis.
- `requestTimeoutMs`: maximum total request time.
- `idleTimeoutMs`: maximum time between streamed result lines.
- HTTP actions reuse the top-level `rateLimiter` settings (keyed by client IP).

Request id sources, in priority order:

1. `X-Request-Id` header
2. `X-Sockethub-Request-Id` header
3. `requestId` field in JSON body

Conflict behavior:

- same `requestId` + request still running: `409`
- same `requestId` + request complete: cached results are replayed

Example request:

```bash
curl -N \
  -H 'Content-Type: application/json' \
  -H 'X-Request-Id: 12345' \
  -d @- \
  http://localhost:10550/sockethub-http <<'JSON'
[
  {
    "context": "xmpp",
    "type": "credentials",
    "actor": { "id": "me" },
    "object": {
      "type": "Credentials",
      "object": { "username": "me", "password": "secret" }
    }
  },
  {
    "context": "xmpp",
    "type": "connect",
    "actor": { "id": "me" }
  },
  {
    "context": "xmpp",
    "type": "join",
    "actor": { "id": "me" },
    "target": { "type": "Room", "id": "room@example.com" }
  },
  {
    "context": "xmpp",
    "type": "send",
    "actor": { "id": "me" },
    "object": { "type": "Note", "content": "hello" }
  }
]
JSON
```

Example response (streamed NDJSON):

```json
{"context":"xmpp","type":"connect","actor":{"type":"person","id":"me"},"id":"1"}
{"context":"xmpp","type":"join","actor":{"type":"person","id":"me"},"target":{"type":"Room","id":"room@example.com"},"id":"2"}
{"context":"xmpp","type":"send","actor":{"type":"person","id":"me"},"object":{"type":"Note","content":"hello"},"id":"3"}
```

Replay results after an interrupted request:

```bash
curl -N http://localhost:10550/sockethub-http/12345
```

Replay using query parameter:

```bash
curl -N "http://localhost:10550/sockethub-http?requestId=12345"
```

### Redis Configuration

```json
{
  "redis": {
    "url": "redis://localhost:6379"
  }
}
```

For authentication:

```json
{
  "redis": {
    "url": "redis://username:password@hostname:port/database"
  }
}
```

### Examples

Enable/disable example pages:

```json
{
  "examples": false  // Set to false for production
}
```

### Logging

Sockethub uses Winston for logging with separate log levels for console and file output.

**Log Levels:** `error`, `warn`, `info`, `debug`

#### Logging Configuration File

```json
{
  "logging": {
    "level": "info",           // Console log level
    "fileLevel": "debug",      // File log level
    "file": "sockethub.log"    // Path to log file (empty string disables file logging)
  }
}
```

**Defaults:**

- Console: `info` (shows info, warn, error)
- File: `debug` (logs everything including debug messages)
- File path: `sockethub.log` in current directory

#### Logging Environment Variables

Override log levels via environment:

```bash
# Console log level
export LOG_LEVEL=warn

# File log level  
export LOG_FILE_LEVEL=debug

# Example: verbose file logging, quiet console
LOG_LEVEL=error LOG_FILE_LEVEL=debug sockethub
```

#### Logging Configuration Priority

For log settings (highest to lowest):

1. Environment variables (`LOG_LEVEL`, `LOG_FILE_LEVEL`)
2. Configuration file (`logging.level`, `logging.fileLevel`, `logging.file`)
3. Defaults (`info` for console, `debug` for file)

#### Common Configurations

**Development** (verbose console, no file):

```json
{
  "logging": {
    "level": "debug",
    "file": ""
  }
}
```

**Production** (quiet console, detailed file):

```json
{
  "logging": {
    "level": "warn",
    "fileLevel": "info",
    "file": "/var/log/sockethub/app.log"
  }
}
```

**Troubleshooting** (everything everywhere):

```bash
LOG_LEVEL=debug LOG_FILE_LEVEL=debug sockethub
```

### Sentry Integration

```json
{
  "sentry": {
    "dsn": "https://your-dsn@sentry.io/project-id",
    "environment": "production",
    "traceSampleRate": 1.0
  }
}
```

### Package Configuration

Configure ActivityStreams behavior:

```json
{
  "packageConfig": {
    "@sockethub/activity-streams": {
      "specialObjs": ["credentials"],
      "failOnUnknownObjectProperties": true
    }
  }
}
```

## Environment Variables

Override configuration with environment variables:

```bash
# Server settings
export HOST=0.0.0.0
export PORT=10550

# Redis connection
export REDIS_URL=redis://localhost:6379

# Logging
export LOG_LEVEL=info        # Console log level (error, warn, info, debug)
export LOG_FILE_LEVEL=debug  # File log level (error, warn, info, debug)

# Sentry (optional)
export SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

## Environment Examples

### Development

```json
{
  "examples": true,
  "sockethub": {
    "port": 10550,
    "host": "localhost",
    "path": "/sockethub"
  },
  "public": {
    "protocol": "http",
    "host": "localhost",
    "port": 10550,
    "path": "/"
  },
  "rateLimiter": {
    "windowMs": 1000,
    "maxRequests": 100,
    "blockDurationMs": 5000
  },
  "redis": {
    "url": "redis://127.0.0.1:6379"
  },
  "platforms": [
    "@sockethub/platform-dummy",
    "@sockethub/platform-feeds"
  ]
}
```

### Production

```json
{
  "examples": false,
  "logging": {
    "level": "warn",
    "fileLevel": "info",
    "file": "/var/log/sockethub/app.log"
  },
  "sockethub": {
    "port": 10550,
    "host": "0.0.0.0",
    "path": "/sockethub"
  },
  "public": {
    "protocol": "https",
    "host": "sockethub.example.com",
    "port": 443,
    "path": "/"
  },
  "rateLimiter": {
    "windowMs": 1000,
    "maxRequests": 100,
    "blockDurationMs": 5000
  },
  "redis": {
    "url": "redis://username:password@redis.example.com:6379"
  },
  "sentry": {
    "dsn": "https://your-dsn@sentry.io/project-id",
    "environment": "production",
    "traceSampleRate": 0.1
  },
  "platforms": [
    "@sockethub/platform-feeds",
    "@sockethub/platform-irc",
    "@sockethub/platform-metadata",
    "@sockethub/platform-xmpp"
  ]
}
```

## Configuration Priority

**General settings:**

1. Command-line arguments (highest priority)
2. Environment variables
3. Configuration file
4. Default values (lowest priority)

**Log level settings:**

1. Environment variables (`LOG_LEVEL`, `LOG_FILE_LEVEL`) (highest priority)
2. Configuration file (`logging.level`, `logging.fileLevel`, `logging.file`)
3. Default values (`info` for console, `debug` for file) (lowest priority)

## Process Management

For production deployments, use a process manager to ensure Sockethub stays running:

### PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start Sockethub
pm2 start sockethub --name "sockethub" -- --config sockethub.config.json

# Save PM2 configuration
pm2 save
pm2 startup

# Monitor
pm2 monit
pm2 logs sockethub
```

### Updates

```bash
npm update sockethub
pm2 restart sockethub
```

- **[Troubleshooting](troubleshooting.md)** - Common configuration issues
