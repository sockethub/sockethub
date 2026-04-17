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
  "credentialCheck": {
    "reconnectIpSource": "socket",
    "proxyHeader": "x-forwarded-for"
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

### Credential Sharing and Anonymous Reconnects

For persistent platforms (for example IRC), Sockethub can reuse an already-running
platform instance for the same `context + actor.id`.

When another socket is already attached to that actor:

- Session-share validation runs in the data layer.
- Credentials with a non-empty `password` are considered shareable.
- Credentials without a non-empty `password` are not shareable and return
  `username already in use`.

This prevents anonymous/username-only accounts from accidentally sharing the
same platform thread across different users.

Sockethub still allows a narrow reconnect case for anonymous credentials:

- The prior session must be stale (disconnected socket, still waiting for janitor cleanup).
- The reconnecting client IP must match the stale session IP.

Configure how reconnect IP is read:

```json
{
  "credentialCheck": {
    "reconnectIpSource": "socket",
    "proxyHeader": "x-forwarded-for"
  }
}
```

- `reconnectIpSource`: `socket` (default) uses `socket.handshake.address`.
- `reconnectIpSource: "proxy"` uses the header named by `proxyHeader`.
- `proxyHeader`: defaults to `x-forwarded-for`; only the first IP is used.

Use `proxy` only when Sockethub is behind a trusted reverse proxy that sets and
sanitizes forwarding headers.

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
