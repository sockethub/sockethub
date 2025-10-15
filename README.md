# Sockethub

[![Sockethub](https://sockethub.org/res/img/sockethub-logo.svg)](https://sockethub.org)

A protocol gateway for the web.

[![Compliance](https://github.com/sockethub/sockethub/actions/workflows/compliance.yml/badge.svg)](https://github.com/sockethub/sockethub/actions/workflows/compliance.yml)
[![CodeQL](https://github.com/sockethub/sockethub/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/sockethub/sockethub/actions/workflows/codeql-analysis.yml)
[![Maintainability](https://api.codeclimate.com/v1/badges/95912fc801271faf44f6/maintainability)](https://codeclimate.com/github/sockethub/sockethub/maintainability)
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

## Documentation

* **[Documentation Hub](docs/README.md)** - Complete documentation index and guides
* **[Getting Started](docs/getting-started/installation.md)** - Installation and quick start
* **[Client Library](docs/client/README.md)** - Browser client library usage
* **[Platform Development](docs/platform-development/creating-platforms.md)** - Creating custom platforms
* **[Architecture](docs/architecture/overview.md)** - Technical architecture overview
* **[Deployment](docs/deployment/server-config.md)** - Production deployment guides

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
bun test                    # Run unit tests
bun run integration         # Run integration tests (requires Redis + Docker)
bun run lint                # Check code style
bun run lint:fix           # Auto-fix linting issues
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

## Credits

Project created and maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/res/img/nlnet-logo.svg)](http://nlnet.nl)
