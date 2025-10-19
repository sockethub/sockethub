# Sockethub Documentation

Welcome to the Sockethub documentation. This guide covers everything you need to know
about using, deploying, and extending Sockethub.

## Quick Navigation

### Getting Started

* **[Getting Started](getting-started.md)** - Installation, first app, and basic concepts
* **[Configuration](configuration.md)** - Server configuration options

### For App Developers

* **[Client Guide](client-guide.md)** - Using the Sockethub client in web applications
* **[Platforms](platforms.md)** - Available platforms and usage examples

### For Platform Developers

* **[Platform Development](platform-development.md)** - Build custom protocol platforms

### Architecture

* **[Architecture](architecture.md)** - How Sockethub works internally

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
