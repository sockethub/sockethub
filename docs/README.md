# Sockethub Documentation

Welcome to the Sockethub documentation. This guide covers everything you need to know
about using, deploying, and extending Sockethub.

## Quick Navigation

### Getting Started

* **[Installation](getting-started/installation.md)** - How to install and run Sockethub
* **[Quick Start](getting-started/quick-start.md)** - Get up and running quickly
* **[Configuration](getting-started/configuration.md)** - Server configuration options

### For App Developers

* **[Client Library](client/README.md)** - Using the Sockethub client in web applications
* **[ActivityStreams](client/activitystreams.md)** - Working with ActivityStreams objects
* **[Platform Usage](client/using-platforms.md)** - How to use different protocol platforms

### For Platform Developers

* **[Creating Platforms](platform-development/creating-platforms.md)** - Build custom protocol platforms
* **[Platform API](platform-development/platform-api.md)** - Platform development interface
* **[Testing](platform-development/testing.md)** - Testing your platforms

### Architecture & Deployment

* **[Architecture Overview](architecture/overview.md)** - How Sockethub works internally
* **[Message Flow](architecture/message-flow.md)** - Request/response processing
* **[Deployment](deployment/production.md)** - Production deployment guide
* **[Server Configuration Examples](deployment/server-config.md)** - Reverse proxy setup

## What is Sockethub?

Sockethub is a translation layer for web applications to communicate with other protocols
and services that are traditionally either inaccessible or impractical to use from
in-browser JavaScript.

Using ActivityStreams objects to pass messages to and from web apps, Sockethub acts as
a smart proxy server/agent that can maintain state and connect to sockets, endpoints,
and networks that would otherwise be restricted from browser applications.

## Key Concepts

* **ActivityStreams**: JSON-based message format for all communication
* **Platforms**: Protocol-specific modules (IRC, XMPP, RSS, etc.)
* **Sessions**: Isolated client connections with secure credential storage
* **Job Queue**: Redis-based reliable message processing

## Community & Support

* **GitHub Repository**: [sockethub/sockethub](https://github.com/sockethub/sockethub)
* **Issues**: [GitHub Issues](https://github.com/sockethub/sockethub/issues)
* **Website**: [sockethub.org](https://sockethub.org)
