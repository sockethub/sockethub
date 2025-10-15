# Configuration

This guide covers Sockethub server configuration options for different deployment
scenarios.

## Configuration File

Sockethub uses a JSON configuration file located at:

- Development: `packages/sockethub/sockethub.config.json`
- Production: Can be specified via `--config` flag or `SOCKETHUB_CONFIG` environment variable

### Default Configuration

```json
{
  "host": "localhost",
  "port": 10550,
  "redis": {
    "url": "redis://localhost:6379"
  },
  "platforms": {
    "dummy": { "enabled": true },
    "feeds": { "enabled": true },
    "irc": { "enabled": true },
    "xmpp": { "enabled": true },
    "metadata": { "enabled": true }
  },
  "examples": {
    "enabled": true
  }
}
```

## Core Settings

### Server Configuration

```json
{
  "host": "0.0.0.0",        // Bind address (use 0.0.0.0 for all interfaces)
  "port": 10550,            // Port to listen on
  "public": {
    "host": "sockethub.example.com",  // Public hostname for clients
    "port": 443,                      // Public port (for reverse proxy setups)
    "protocol": "https"               // Public protocol
  }
}
```

### Redis Configuration

**Basic Redis:**

```json
{
  "redis": {
    "url": "redis://localhost:6379"
  }
}
```

**Redis with Authentication:**

```json
{
  "redis": {
    "url": "redis://username:password@hostname:port/database"
  }
}
```

**Redis Cluster:**

```json
{
  "redis": {
    "cluster": true,
    "nodes": [
      { "host": "redis1.example.com", "port": 7001 },
      { "host": "redis2.example.com", "port": 7002 },
      { "host": "redis3.example.com", "port": 7003 }
    ]
  }
}
```

**Advanced Redis Options:**

```json
{
  "redis": {
    "url": "redis://localhost:6379",
    "options": {
      "connectTimeout": 10000,
      "lazyConnect": true,
      "maxRetriesPerRequest": 3,
      "retryDelayOnFailover": 100,
      "enableReadyCheck": false,
      "maxMemoryPolicy": "allkeys-lru"
    }
  }
}
```

## Platform Configuration

### Enable/Disable Platforms

```json
{
  "platforms": {
    "dummy": { "enabled": true },    // Test platform
    "irc": { "enabled": true },      // IRC support
    "xmpp": { "enabled": false },    // Disable XMPP
    "feeds": { "enabled": true },    // RSS/Atom feeds
    "metadata": { "enabled": true }  // Web metadata
  }
}
```

### Platform-Specific Settings

```json
{
  "platforms": {
    "irc": {
      "enabled": true,
      "timeout": 30000,              // Connection timeout
      "retries": 3,                  // Reconnection attempts
      "rateLimit": {
        "messages": 5,               // Messages per interval
        "interval": 1000             // Interval in milliseconds
      }
    },
    "xmpp": {
      "enabled": true,
      "features": {
        "muc": true,                 // Multi-user chat support
        "presence": true,            // Presence updates
        "roster": true               // Contact list management
      }
    }
  }
}
```

## Security Configuration

### CORS Settings

```json
{
  "cors": {
    "origin": "*",                   // Allow all origins (development only)
    "methods": ["GET", "POST"],
    "credentials": true
  }
}
```

**Production CORS:**

```json
{
  "cors": {
    "origin": [
      "https://myapp.example.com",
      "https://anotherapp.example.com"
    ],
    "methods": ["GET", "POST"],
    "credentials": true
  }
}
```

### Rate Limiting

```json
{
  "rateLimit": {
    "enabled": true,
    "windowMs": 60000,               // 1 minute window
    "max": 100,                      // Max requests per window
    "message": "Too many requests",
    "standardHeaders": true,
    "legacyHeaders": false
  }
}
```

### Encryption Settings

```json
{
  "encryption": {
    "algorithm": "aes-256-gcm",      // Encryption algorithm
    "keyLength": 32,                 // Key length in bytes
    "ivLength": 16,                  // IV length in bytes
    "tagLength": 16                  // Auth tag length
  }
}
```

## Logging Configuration

### Basic Logging

```json
{
  "logging": {
    "level": "info",                 // error, warn, info, debug
    "format": "json",                // json, text
    "timestamp": true
  }
}
```

### Advanced Logging

```json
{
  "logging": {
    "level": "debug",
    "transports": [
      {
        "type": "console",
        "format": "text",
        "colorize": true
      },
      {
        "type": "file",
        "filename": "/var/log/sockethub/app.log",
        "format": "json",
        "maxSize": "10m",
        "maxFiles": "7d"
      }
    ]
  }
}
```

### Sentry Integration

```json
{
  "sentry": {
    "dsn": "https://your-dsn@sentry.io/project-id",
    "environment": "production",
    "traceSampleRate": 1.0,
    "profilesSampleRate": 0.1,
    "beforeSend": {
      "filterLocalhost": true
    }
  }
}
```

## Performance Configuration

### Connection Pooling

```json
{
  "connectionPool": {
    "max": 100,                      // Max concurrent connections
    "min": 10,                       // Minimum pool size
    "acquireTimeoutMillis": 30000,   // Acquisition timeout
    "idleTimeoutMillis": 300000      // Idle timeout
  }
}
```

### Memory Management

```json
{
  "memory": {
    "heapSize": "2g",                // Node.js heap size
    "gcInterval": 300000,            // Garbage collection interval
    "memoryThreshold": 0.8           // Warning threshold (80%)
  }
}
```

### Worker Process Settings

```json
{
  "workers": {
    "platformInstances": {
      "max": 50,                     // Max platform processes
      "timeout": 30000,              // Process timeout
      "retries": 3,                  // Restart attempts
      "memoryLimit": "256m"          // Memory limit per process
    }
  }
}
```

## Environment-Specific Configurations

### Development

```json
{
  "host": "localhost",
  "port": 10550,
  "examples": { "enabled": true },
  "logging": { "level": "debug" },
  "cors": { "origin": "*" },
  "platforms": {
    "dummy": { "enabled": true },
    "feeds": { "enabled": true }
  }
}
```

### Production

```json
{
  "host": "0.0.0.0",
  "port": 10550,
  "examples": { "enabled": false },
  "logging": {
    "level": "info",
    "transports": [
      { "type": "file", "filename": "/var/log/sockethub/app.log" }
    ]
  },
  "cors": {
    "origin": ["https://myapp.example.com"]
  },
  "rateLimit": { "enabled": true },
  "sentry": {
    "dsn": "https://your-dsn@sentry.io/project-id",
    "environment": "production"
  }
}
```

### Docker

```json
{
  "host": "0.0.0.0",
  "port": 10550,
  "redis": {
    "url": "redis://redis:6379"
  },
  "logging": {
    "transports": [{ "type": "console", "format": "json" }]
  }
}
```

## Environment Variables

Override configuration with environment variables:

```bash
# Server settings
export SOCKETHUB_HOST=0.0.0.0
export SOCKETHUB_PORT=10550

# Redis connection
export REDIS_URL=redis://localhost:6379

# Logging
export LOG_LEVEL=info

# Sentry (optional)
export SENTRY_DSN=https://your-dsn@sentry.io/project-id

# Examples
export EXAMPLES_ENABLED=false
```

### Docker Environment

```yaml
# docker-compose.yml
services:
  sockethub:
    image: sockethub/sockethub
    environment:
      - SOCKETHUB_HOST=0.0.0.0
      - SOCKETHUB_PORT=10550
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=info
      - EXAMPLES_ENABLED=false
      - SENTRY_DSN=${SENTRY_DSN}
```

## Validation

Validate your configuration:

```bash
# Check configuration syntax
bun run config:validate

# Test configuration
bun run config:test

# Show effective configuration
bun run config:show
```

## Troubleshooting

### Common Issues

**Port already in use:**

```json
{
  "port": 10551  // Change to available port
}
```

**Redis connection fails:**

```json
{
  "redis": {
    "url": "redis://correct-host:6379",
    "options": {
      "connectTimeout": 10000,
      "retryDelayOnFailover": 100
    }
  }
}
```

**Memory issues:**

```bash
# Set Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

**CORS errors:**

```json
{
  "cors": {
    "origin": ["https://your-app-domain.com"],
    "credentials": true
  }
}
```

### Debug Configuration

Enable configuration debugging:

```bash
DEBUG=sockethub:config bun run start
```

### Configuration Templates

See example configurations in:

- `packages/sockethub/config/`
- `docs/deployment/`
- Environment-specific examples

## Next Steps

- **[Production Deployment](../deployment/production.md)** - Deploy in production
- **[Server Configuration Examples](../deployment/server-config.md)** - Reverse proxy setup
- **[Monitoring](../deployment/monitoring.md)** - Production monitoring setup
