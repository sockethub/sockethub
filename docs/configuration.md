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
  "log_file": "",
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

```json
{
  "log_file": "/var/log/sockethub/app.log"  // Empty string for console only
}
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

# Sentry (optional)
export SENTRY_DSN=https://your-dsn@sentry.io/project-id

# Debug logging
export DEBUG=sockethub*
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
  "log_file": "/var/log/sockethub/app.log",
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

1. Command-line arguments (highest priority)
2. Environment variables
3. Configuration file
4. Default values (lowest priority)

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
