# Production Deployment

A simple guide for deploying Sockethub in production using the npm package.

## Installation

```bash
# Install Sockethub
npm install sockethub

# Or install globally
npm install -g sockethub
```

## Configuration

Create a `sockethub.config.json` file for production:

```json
{
  "host": "0.0.0.0",
  "port": 10550,
  "redis": {
    "url": "redis://localhost:6379"
  },
  "platforms": [
    "@sockethub/platform-feeds",
    "@sockethub/platform-irc",
    "@sockethub/platform-xmpp",
    "@sockethub/platform-metadata"
  ],
  "examples": false,
  "sentry": {
    "dsn": "https://your-dsn@sentry.io/project-id",
    "environment": "production"
  }
}
```

### Key Production Settings

**Disable Examples:**

```json
{
  "examples": false
}
```

**Configure Sentry (Optional):**

```json
{
  "sentry": {
    "dsn": "https://your-dsn@sentry.io/project-id",
    "environment": "production"
  }
}
```

## Process Management

### Option 1: PM2

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

### Option 2: Package.json Scripts

Create a `package.json` with production scripts:

```json
{
  "name": "my-sockethub-deployment",
  "scripts": {
    "start": "sockethub --config sockethub.config.json",
    "dev": "DEBUG=sockethub* sockethub --config sockethub.config.json"
  },
  "dependencies": {
    "sockethub": "^5.0.0"
  }
}
```

```bash
# Start production
npm start

# Start with debug logging
npm run dev
```

## Redis Setup

Make sure Redis is running and configure it in your Sockethub config:

```json
{
  "redis": {
    "url": "redis://localhost:6379",
    "password": "your-redis-password"
  }
}
```

## Environment Variables

You can use environment variables instead of config file settings:

```bash
export SOCKETHUB_HOST=0.0.0.0
export SOCKETHUB_PORT=10550
export REDIS_URL=redis://localhost:6379
export NODE_ENV=production
export EXAMPLES_ENABLED=false

# Start Sockethub
sockethub
```

## Error Reporting

### Sentry (Optional)

Add Sentry for error tracking:

```json
{
  "sentry": {
    "dsn": "https://your-dsn@sentry.io/project-id",
    "environment": "production",
    "traceSampleRate": 0.1
  }
}
```

### Simple Logging

Basic file logging can be configured:

```json
{
  "log_file": "./logs/sockethub.log"
}
```

## Monitoring

### Simple Monitor Script

Basic process monitoring:

```bash
#!/bin/bash
# monitor.sh

if ! pgrep -f "sockethub" > /dev/null; then
    echo "Sockethub is down, restarting..."
    pm2 restart sockethub
fi
```

## Security Considerations

### Disable Development Features

```json
{
  "examples": false,
  "platforms": [
    "@sockethub/platform-feeds",
    "@sockethub/platform-irc", 
    "@sockethub/platform-xmpp",
    "@sockethub/platform-metadata"
  ]
}
```

Note: Remove `@sockethub/platform-dummy` from platforms array in production.

### Redis Password

Always set a Redis password in production:

```json
{
  "redis": {
    "url": "redis://localhost:6379",
    "password": "strong-random-password"
  }
}
```

## Updates

Update Sockethub:

```bash
npm update sockethub
pm2 restart sockethub
```

## Troubleshooting

### Check if Sockethub is Running

```bash
# Test the health endpoint
curl http://localhost:10550/health

# Check PM2 status
pm2 status

# View logs
pm2 logs sockethub
```

### Common Issues

**Redis Connection Failed:**

- Ensure Redis is running
- Check Redis password in config
- Test: `redis-cli ping`

**WebSocket Connection Issues:**

- Check CORS configuration
- Verify client is connecting to correct URL
- Enable debug logging: `DEBUG=sockethub* npm start`

**Platform Errors:**

- Check platform-specific requirements
- Verify credentials format matches platform documentation
- Review debug logs for specific platform errors

## Debug Mode

Run with debug logging to troubleshoot issues:

```bash
# All debug output
DEBUG=sockethub* sockethub --config sockethub.config.json

# Specific components
DEBUG=sockethub:platform:irc sockethub --config sockethub.config.json
DEBUG=sockethub:server:middleware sockethub --config sockethub.config.json
```

This covers the essential Sockethub-specific configuration and deployment considerations
for production use.

## See Also

- **[Configuration Guide](../getting-started/configuration.md)** - Complete configuration options
- **[Server Configuration Examples](server-config.md)** - Reverse proxy setup
