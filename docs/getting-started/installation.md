# Installation

This guide covers installing Sockethub for development and production use.

## Prerequisites

### Required

- **Bun** v1.2+ (Node.js runtime and package manager)
- **Redis** server v6.0+ (for data layer and job queue)
- **Git** (for cloning the repository)

### Installing Prerequisites

**Bun:**

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
```

**Redis:**

```bash
# macOS with Homebrew
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

## Installation Methods

### Method 1: From Source (Recommended for Development)

1. **Clone the repository:**

   ```bash
   git clone https://github.com/sockethub/sockethub.git
   cd sockethub
   ```

2. **Install dependencies:**

   ```bash
   bun install
   ```

3. **Build the project:**

   ```bash
   bun run build
   ```

4. **Verify installation:**

   ```bash
   bun test
   ```

### Method 2: Using Docker

```bash
# Clone and start with Docker Compose
git clone https://github.com/sockethub/sockethub.git
cd sockethub
bun run docker:start
```

## Configuration

### Basic Configuration

Copy the default configuration file:

```bash
cp packages/sockethub/sockethub.config.json.example packages/sockethub/sockethub.config.json
```

### Redis Configuration

If Redis is not running on localhost:6379, update your configuration:

```json
{
  "redis": {
    "url": "redis://localhost:6379"
  }
}
```

For remote Redis or authentication:

```json
{
  "redis": {
    "url": "redis://username:password@host:port"
  }
}
```

## Running Sockethub

### Development Mode

Start the development server with examples:

```bash
DEBUG=sockethub* bun run dev
```

Browse to `http://localhost:10550` to see the examples.

### Production Mode

Start the production server:

```bash
bun run start
```

## Verification

### Check Server Status

1. **Server logs**: Look for "Sockethub server started"
2. **Redis connection**: Check for "Redis connection established"
3. **Platform loading**: Verify platforms load without errors

### Test with Examples

Visit `http://localhost:10550/examples/` and try:

- Dummy platform echo test
- Feed fetching example
- IRC or XMPP connection (with valid credentials)

## Troubleshooting

### Common Issues

**Redis connection failed:**

- Ensure Redis is running: `redis-cli ping`
- Check Redis configuration in config file
- Verify network connectivity to Redis host

**Port 10550 already in use:**

- Change port in configuration file
- Kill existing Sockethub process
- Use different port: `PORT=10551 bun run dev`

**Build failures:**

- Ensure Bun v1.2+ is installed: `bun --version`
- Clean and reinstall: `bun run clean:deps && bun install`
- Check for permission issues

**Platform loading errors:**

- Verify all dependencies installed
- Check platform-specific requirements
- Review debug logs: `DEBUG=sockethub:platform:* bun run dev`

## Next Steps

- **[Quick Start Guide](quick-start.md)** - Get started with your first Sockethub app
- **[Configuration](configuration.md)** - Detailed configuration options
- **[Client Documentation](../client/README.md)** - Using the Sockethub client library
