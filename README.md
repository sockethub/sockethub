# Sockethub

[![Sockethub](https://sockethub.org/res/img/sockethub-logo.svg)](https://sockethub.org)

A protocol gateway for the web.

[![Compliance](https://github.com/sockethub/sockethub/actions/workflows/compliance.yml/badge.svg)](https://github.com/sockethub/sockethub/actions/workflows/compliance.yml)
[![CodeQL](https://github.com/sockethub/sockethub/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/sockethub/sockethub/actions/workflows/codeql-analysis.yml)
[![Release](https://img.shields.io/npm/v/sockethub.svg?style=flat)](https://github.com/sockethub/sockethub/releases)

## About

Sockethub is a translation layer for web applications to communicate with
other protocols and services that are traditionally either inaccessible or
impractical to use from in-browser JavaScript.

Built with modern TypeScript and powered by Bun, Sockethub is organized as a
monorepo containing multiple packages that work together to provide a robust,
extensible platform gateway.

Using [ActivityStreams](https://www.w3.org/TR/activitystreams-core/) (AS) objects to pass messages
to and from the web app, Sockethub acts as a smart proxy server/agent, which
can maintain state, and connect to sockets, endpoints, and networks that would
otherwise, be restricted from an application running in the browser.

Originally inspired as a sister project to
[RemoteStorage](https://remotestorage.io), and assisting in the development of
[unhosted](http://unhosted.org) and [noBackend](http://nobackend.org)
applications, Sockethub's functionality can also fit into a more traditional
development stack, removing the need for custom code to handle various protocol
specifics at the application layer.

Example uses of Sockethub include:

* **Chat protocols**: XMPP, IRC

* **Feed processing**: RSS, Atom feeds

* **Metadata discovery**: Link preview generation, metadata extraction

* **Protocol translation**: Converting between web-friendly ActivityStreams and traditional protocols

*Additional protocols like SMTP, IMAP, Nostr, and others can be implemented as custom platforms.*

The architecture of Sockethub is extensible and supports easy implementation
of additional 'platforms' to carry out tasks.

## Architecture

Sockethub uses a multi-process architecture for stability and isolation:

* **Main Server** (`packages/server/`) - Socket.IO connections, middleware
  pipeline for validation and routing
* **Platform Processes** - Each protocol (IRC, XMPP, Feeds) runs as an
  isolated child process
* **Job Queue** - Redis-backed BullMQ ensures reliable message delivery
  between server and platforms
* **Data Layer** - Encrypted credential storage and session management in Redis
* **ActivityStreams** - Uniform message format for all platform communication

**Request Flow:**

1. Client connects via Socket.IO
2. Messages validated through middleware pipeline
3. Credentials encrypted and stored per-session in Redis
4. Messages queued to appropriate platform instance
5. Platform processes handle protocol-specific logic
6. Responses sent back through Socket.IO

For detailed architecture documentation, see [Architecture Overview](docs/architecture/overview.md).

## Documentation

* **[Documentation Hub](docs/README.md)** - Complete documentation index and guides
* **[Getting Started](docs/getting-started/installation.md)** - Installation and quick start
* **[Client Library](docs/client/README.md)** - Browser client library usage
* **[Platform Development](docs/platform-development/creating-platforms.md)** - Creating custom platforms
* **[Architecture](docs/architecture/overview.md)** - Technical architecture overview
* **[Deployment](docs/deployment/server-config.md)** - Production deployment guides
* **[Performance Testing](stress-tests/README.md)** - Load testing and benchmarking

## Features

We use ActivityStreams to map the various actions of a platform to a set of AS
'@type's which identify the underlying action. For example, using the XMPP
platform, a friend request/accept cycle would use the activity stream types
'request-friend', 'remove-friend', 'make-friend'.

## Platforms

Making a platform is as simple as creating a platform module that defines a
schema and a series of functions that map to ActivityStream verbs. Each platform
can be enabled/disabled in the `config.json`.

### Currently Implemented Platforms

* **[Feeds](packages/platform-feeds)** - RSS and Atom feed processing
* **[IRC](packages/platform-irc)** - Internet Relay Chat protocol support  
* **[XMPP](packages/platform-xmpp)** - Extensible Messaging and Presence Protocol
* **[Metadata](packages/platform-metadata)** - Link preview and metadata extraction

### Development Reference

* **[Dummy](packages/platform-dummy)** - Example platform implementation for developers

For platform development guidance, see the [Platform Development documentation](packages/platform-dummy/README.md).

## Quick Start

**Note:** This is a monorepo using Bun workspaces managed by Lerna Lite.

### Prerequisites

* **Bun** v1.2+ (Node.js runtime and package manager)
* **Redis** server (for data layer and job queue)

### Installation & Development

```bash
# Install dependencies
bun install

# Start Redis (required for data layer)
# - Using Docker: docker run -d -p 6379:6379 redis:alpine
# - Using system package manager: brew install redis && brew services start redis

# Build and start development server with examples
bun run dev
```

Browse to `http://localhost:10550` to try the interactive examples.

### Production

```bash
# Build for production
bun run build

# Start production server (examples disabled)
bun run start
```

### Development Commands

```bash
# Testing
bun test                    # Run unit tests across all packages
bun run integration         # Run both Redis and browser integration tests
bun run integration:redis   # Run Redis integration tests with Docker
bun run integration:browser # Run browser integration tests with Docker

# Performance & Stress Testing
bun run stress:baseline     # Generate system performance baseline (first time)
bun run stress:performance  # Run performance tests (~10 min)
bun run stress:stress       # Run stress tests (~15 min)
bun run stress:soak         # Run soak test (30 min)
bun run stress:all          # Run all tests (~60 min)
bun run stress:ci           # CI smoke test (1-2 min)
bun run stress:report --latest  # View latest test results

# Code Quality
bun run lint                # Run Biome linter and markdown lint
bun run lint:fix           # Auto-fix linting issues

# Maintenance
bun run clean              # Clean build artifacts
bun run clean:deps         # Clean dependencies and node_modules

# Docker
bun run docker:start       # Start Prosody and Sockethub services
bun run docker:start:redis # Start only Redis service
bun run docker:stop        # Stop all Docker services
```

### Environment Variables

For debugging and configuration options, see the [Server package documentation](packages/server/README.md#environment-variables).

**Debug logging:**

```bash
DEBUG=sockethub* bun run dev
```

## Packages

### Core Infrastructure

* **[sockethub](packages/sockethub)** - Main package and configuration
* **[@sockethub/server](packages/server)** - Core server implementation with Socket.IO interface
* **[@sockethub/data-layer](packages/data-layer)** - Redis-based job queue and credential storage
* **[@sockethub/schemas](packages/schemas)** - ActivityStreams validation and TypeScript types
* **[@sockethub/client](packages/client)** - Browser client library for connecting to Sockethub

### Interactive Demos

* **[@sockethub/examples](packages/examples)** - Interactive web examples and demos

### Platform Implementations

* **[@sockethub/platform-dummy](packages/platform-dummy)** - Example platform for development reference
* **[@sockethub/platform-feeds](packages/platform-feeds)** - RSS and Atom feed processing
* **[@sockethub/platform-irc](packages/platform-irc)** - IRC protocol support
* **[@sockethub/platform-metadata](packages/platform-metadata)** - Link preview and metadata extraction
* **[@sockethub/platform-xmpp](packages/platform-xmpp)** - XMPP protocol support

### Utilities

* **[@sockethub/activity-streams](packages/activity-streams)** - ActivityStreams object utilities
* **[@sockethub/crypto](packages/crypto)** - Cryptographic utilities for secure storage
* **[@sockethub/irc2as](packages/irc2as)** - IRC to ActivityStreams translation

## Contributing

### Key Files to Understand

* `packages/sockethub/sockethub.config.json` - Main configuration file
* `packages/server/src/sockethub.ts` - Main server class handling Socket.IO
  connections
* `packages/server/src/platform-instance.ts` - Platform process management
* `packages/server/src/middleware/` - Request processing pipeline
* `packages/data-layer/src/job-queue.ts` - Redis-based job queue (BullMQ)
* `packages/data-layer/src/credentials-store.ts` - Encrypted credential storage
* `packages/platform-*/` - Individual protocol implementations

### Creating a New Platform

Each platform must:

1. Implement the `PlatformInterface` from `@sockethub/schemas`
2. Define a schema with supported message types and credential requirements
3. Run as an isolated child process (managed by the server)
4. Translate between protocol-specific messages and ActivityStreams objects

See the [Platform Development documentation](docs/platform-development/creating-platforms.md)
and [Dummy platform](packages/platform-dummy) for a complete reference
implementation.

### Architectural Patterns to Follow

* **Process Isolation**: Platforms run as separate child processes for stability
* **Job Queue**: All platform communication goes through Redis-backed BullMQ
* **Middleware Pipeline**: Requests flow through validation, credential storage,
  and routing
* **Session Management**: Credentials are encrypted per-session and isolated per
  connection
* **ActivityStreams**: Use ActivityStreams objects as the uniform message format

## Credits

Project created and maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/res/img/nlnet-logo.svg)](http://nlnet.nl)
