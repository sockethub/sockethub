# Sockethub

[![Sockethub](https://sockethub.org/res/img/sockethub-logo.svg)](https://sockethub.org)

A protocol gateway for the web.

[![Compliance](https://github.com/sockethub/sockethub/actions/workflows/compliance.yml/badge.svg)](https://github.com/sockethub/sockethub/actions/workflows/compliance.yml)
[![CodeQL](https://github.com/sockethub/sockethub/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/sockethub/sockethub/actions/workflows/codeql-analysis.yml)
[![Release](https://img.shields.io/npm/v/sockethub.svg?style=flat)](https://github.com/sockethub/sockethub/releases)

Sockethub lets browser apps talk to IRC, XMPP, feeds, and other protocols using
one ActivityStreams JSON format. Your app sends a single message shape, and
Sockethub handles connections, credentials, and protocol translation.

## What You Can Do

* Send and receive chat messages (IRC, XMPP)
* Fetch and parse feeds (RSS, Atom)
* Generate link previews and metadata
* Add new protocols as custom platforms

## ActivityStreams In/Out

Sockethub uses ActivityStreams JSON for all platforms. Your app sends the same
shape for IRC, XMPP, feeds, and more, and receives the same shape back. Only
`context` changes.

### Side-by-side Examples

<picture>
  <source
    media="(prefers-color-scheme: dark)"
    srcset="https://sockethub.org/res/img/activitystreams-send-receive.dark.svg"
  />
  <source
    media="(prefers-color-scheme: light)"
    srcset="https://sockethub.org/res/img/activitystreams-send-receive.svg"
  />
  <img
    alt="ActivityStreams send/receive examples"
    src="https://sockethub.org/res/img/activitystreams-send-receive.svg"
  />
</picture>

The `context` selects a platform; the rest stays consistent.

## About

Sockethub is a translation layer for web applications to communicate with
protocols and services that are impractical to use from in-browser JavaScript.
It runs server-side, keeps long-lived connections, and exposes everything as
ActivityStreams JSON.

Built with modern TypeScript and powered by Bun, Sockethub is organized as a
monorepo with packages for the server, client, schemas, and platforms.

Originally inspired as a sister project to
[RemoteStorage](https://remotestorage.io), and assisting in the development of
[unhosted](http://unhosted.org) and [noBackend](http://nobackend.org),
Sockethub also fits into traditional stacks by removing protocol-specific code
from the application layer.

## Architecture

Sockethub runs each protocol in its own process and moves messages through
Redis so browsers can talk to long-lived connections safely.

* **Main Server** (`packages/server/`) - Socket.IO, validation, routing
* **Platform Processes** - One process per protocol
* **Job Queue** - Redis-backed BullMQ between server and platforms
* **Data Layer** - Encrypted credentials and session state in Redis

**Request Flow:**

1. Client connects via Socket.IO
2. Message validated and routed
3. Credentials are encrypted and stored per session in Redis
4. Message queued to platform
5. Platform responds via Socket.IO

For detailed architecture documentation, see [Architecture](docs/architecture.md).

## Documentation

* **[Documentation Hub](docs/README.md)** - Complete documentation index and guides
* **[Getting Started](docs/getting-started.md)** - Installation and quick start
* **[Client Guide](docs/client-guide.md)** - Browser client library usage
* **[Platform Development](docs/platform-development.md)** - Creating custom platforms
* **[Architecture](docs/architecture.md)** - Technical architecture overview
* **[Configuration](docs/configuration.md)** - Server configuration options
* **[Contributing](docs/CONTRIBUTING.md)** - Developer workflow and commands
* **[Performance Testing](stress-tests/README.md)** - Load testing and benchmarking

## Capabilities

Sockethub standardizes platform actions as ActivityStreams `type` values. For
example, an XMPP friend request can be modeled as `request-friend`,
`remove-friend`, and `make-friend` in a consistent format.

### Included Platforms

* **[Feeds](packages/platform-feeds)** - RSS and Atom feed processing
* **[IRC](packages/platform-irc)** - Internet Relay Chat protocol support
* **[XMPP](packages/platform-xmpp)** - Extensible Messaging and Presence Protocol
* **[Metadata](packages/platform-metadata)** - Link preview and metadata extraction

### Build Your Own

Create a platform module that defines a schema and maps ActivityStreams verbs.
Enable or disable platforms in `config.json`.

* **[Dummy](packages/platform-dummy)** - Example platform for developers
* **[Platform Development docs](docs/platform-development.md)** - Full guide

## Quick Start

### Requirements

* **Bun** v1.2+
* **Redis** (data layer and job queue)

### CLI Install

```bash
npm install -g sockethub
sockethub --help
```

```bash
# Install dependencies
bun install

# Start Redis (required for data layer)
# - Docker: docker run -d -p 6379:6379 redis:alpine
# - Homebrew: brew install redis && brew services start redis

# Start dev server with examples
bun run dev
```

Open `http://localhost:10550` for the interactive examples.

### Production

```bash
bun run build
bun run start
```

### Environment Variables

For debugging and configuration options, see the [Server package documentation](packages/server/README.md#environment-variables).

**Debug logging:**

```bash
DEBUG=sockethub* bun run dev
```

## Packages

### Core Infrastructure

* **[sockethub](packages/sockethub)** - Main meta-package for installing Sockethub
* **[@sockethub/client](packages/client)** - Browser client library for connecting to Sockethub
* **[@sockethub/data-layer](packages/data-layer)** - Redis-based job queue and credential storage
* **[@sockethub/schemas](packages/schemas)** - ActivityStreams validation and TypeScript types
* **[@sockethub/server](packages/server)** - Core server implementation with Socket.IO interface

### Libraries

* **[@sockethub/activity-streams](packages/activity-streams)** - ActivityStreams object utilities
* **[@sockethub/crypto](packages/crypto)** - Cryptographic utilities for secure storage
* **[@sockethub/irc2as](packages/irc2as)** - IRC to ActivityStreams translation
* **[@sockethub/logger](packages/logger)** - Winston-based logger with global configuration

### Platform Implementations

* **[@sockethub/platform-dummy](packages/platform-dummy)** - Example platform for development reference
* **[@sockethub/platform-feeds](packages/platform-feeds)** - RSS and Atom feed processing
* **[@sockethub/platform-irc](packages/platform-irc)** - IRC protocol support
* **[@sockethub/platform-metadata](packages/platform-metadata)** - Link preview and metadata extraction
* **[@sockethub/platform-xmpp](packages/platform-xmpp)** - XMPP protocol support

### Example Package

* **[@sockethub/examples](packages/examples)** - Example client app (served with `sockethub --examples`)

## Credits

Project created and maintained by [Nick Jennings](https://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](https://jancborchardt.net)

Sponsored by [NLNET](https://nlnet.nl)

[![NLNET Logo](https://sockethub.org/res/img/nlnet-logo.svg)](https://nlnet.nl)
