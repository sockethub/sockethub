# Sockethub Examples

A collection of interactive web examples demonstrating how to use Sockethub's various protocol platforms.
These examples show how client applications can communicate with Sockethub using ActivityStreams messages
to interact with different protocols like IRC, XMPP, RSS feeds, and more.

## What is Sockethub?

Sockethub is a protocol gateway that translates web application messages into various protocols
(IRC, XMPP, RSS, etc.) using ActivityStreams objects. These examples demonstrate the client-side
interaction - sending ActivityStreams messages to Sockethub, which handles all the protocol-specific
communication.

## Available Platform Examples

### Dummy Platform

**Purpose**: Testing and learning ActivityStreams basics

- Sends test messages to Sockethub's dummy platform
- Demonstrates echo, fail, throw, and greet activities
- Perfect for understanding ActivityStreams message structure

### Feeds Platform  

**Purpose**: RSS/ATOM feed processing

- Fetches and parses RSS/ATOM feeds through Sockethub
- Converts feed entries to ActivityStreams objects

### IRC Platform

**Purpose**: Internet Relay Chat communication

- Connects to IRC servers through Sockethub's IRC platform
- Supports joining channels and sending/receiving messages

### XMPP Platform

**Purpose**: XMPP (Jabber) chat communication  

- Connects to XMPP servers through Sockethub's XMPP platform
- Supports joining chat rooms and messaging

### Metadata Platform

**Purpose**: Website metadata extraction

- Extracts metadata from web pages through Sockethub
- Analyzes Open Graph, Twitter Cards, and other metadata

## Prerequisites

1. **Sockethub Server**: These examples require a running Sockethub server

## Setup Instructions

### 1. Start Sockethub Server

From the main Sockethub repository root:

```bash
# Install dependencies
bun install

# Start Sockethub server with examples enabled
bun run dev
```

This starts Sockethub on `localhost:10550` with the examples interface available.

### 2. Running Examples Standalone (Optional)

To run just the examples interface separately:

```bash
cd packages/examples

# Install dependencies (if not already done)
bun install

# Start development server
bun run dev

# Or start and open in browser
bun run dev -- --open
```

## Usage Guide

### Basic Flow

1. **Navigate** to a platform example (e.g., IRC, XMPP)
2. **Configure** connection details (server, credentials)
3. **Connect** to the platform through Sockethub
4. **Interact** with the protocol (join rooms, send messages, fetch feeds)
5. **Monitor** ActivityStreams messages in the logger

### What You'll See

- **Request messages**: ActivityStreams objects sent to Sockethub
- **Response messages**: Results returned by Sockethub platforms
- **Real-time updates**: Live protocol interactions
- **Error handling**: Clear error messages for troubleshooting

## Development

### Running in Development Mode

```bash
bun run dev
```

### Building for Production

```bash
bun run build
```

The build output goes to the `build/` directory and is automatically copied to the main Sockethub
server's static assets.

### Testing

```bash
# Unit tests
bun test

# Integration tests  
bun run test:integration 
```

## Troubleshooting

### Connection Issues

**Problem**: "Failed to connect to Sockethub"

- **Solution**: Ensure Sockethub server is running on `localhost:10550`
- **Check**: `curl http://localhost:10550/sockethub` should return server info

**Problem**: "Platform not available"

- **Solution**: Check that the platform is enabled in Sockethub configuration
- **Check**: Server logs for platform initialization errors

### Platform-Specific Issues

**IRC**:

- Verify server address and port are correct
- Check if server requires registration/authentication
- Some networks block connections from certain IPs

**XMPP**:

- Ensure XMPP account credentials are valid
- Check if server allows external connections
- Verify server supports the features being used

**Feeds**:

- Confirm feed URL is accessible and valid RSS/ATOM
- Check for CORS issues with feed domain
- Some feeds may require authentication

## Contributing

These examples are part of the main Sockethub project. See the main repository for contribution guidelines.

## Learn More

- [Sockethub](https://github.com/sockethub/sockethub)
- [ActivityStreams Specification](https://www.w3.org/TR/activitystreams-core/)
