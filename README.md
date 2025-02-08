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

Using [ActivityStream](http://activitystrea.ms/) (AS) objects to pass messages
to and from the web app, Sockethub acts as a smart proxy server/agent, which
can maintain state, and connect to sockets, endpoints, and networks that would
otherwise, be restricted from an application running in the browser.

Originally inspired as a sister project to
[RemoteStorage](https://remotestorage.io), and assisting in the development of
[unhosted](http://unhosted.org) and [noBackend](http://nobackend.org)
applications, Sockethub's functionality can also fit into a more traditional
development stack, removing the need for custom code to handle various protocol
specifics at the application layer.

Example uses of Sockethub are:

* Writing and receiving messages (SMTP, IMAP, Nostr ...)

* Chat (XMPP, IRC, SimpleX, ...)

* Discovery (WebFinger, RDF(a), Link preview generation ...)

The architecture of Sockethub is extensible and supports easy implementation
of additional 'platforms' to carry out tasks.

## Docs

See the [Sockethub wiki](https://github.com/sockethub/sockethub/wiki) for
documentation.

## Features

We use ActivityStreams to map the various actions of a platform to a set of AS
'@type's which identify the underlying action. For example, using the XMPP
platform, a friend request/accept cycle would use the activity stream types
'request-friend', 'remove-friend', 'make-friend'.

Below is a list of platform contexts we're currently working on and their types,
both the completed and not yet implemented ones. They are all implemented in
Sockethub platforms (each in their own repository) and can be enabled/disabled
in the `config.json`.

## Platforms

Making a platform is as simple as creating a platform module that defines a
schema and a series of functions that map to verbs. Take a look at some of
our existing platforms for examples.

* [Feeds](packages/platform-feeds) *(RSS, Atom)*

* [IRC](packages/platform-irc)

* [XMPP](packages/platform-xmpp)

## Run

To get up and running quickly, you only need the following commands:

```bash
bun install
bun run dev
```

### Dependencies

```bun install```

### Build

```bun run build```

### Tests

```bun test```

### Linter

```bun run lint```

Or, to automatically fix linting errors:

```bun run lint:fix```

### Integration Tests

```bun run  integration```

## Start

For development purposes, with examples enabled, run:

`DEBUG=sockethub* bun run dev`

You should then be able to browse to `http://localhost:10550` and try out the examples.

For production, with examples disabled.

`DEBUG=sockethub* bun run start`

*For more info on configuration options, see the
[Sockethub README](packages/sockethub/README.md#environment-variables)*
section on environment variables.*

## Packages

* [sockethub](packages/sockethub)
* [@sockethub/activity-streams](packages/activity-streams)
* [@sockethub/client](packages/client)
* [@sockethub/crypto](packages/crypto)
* [@sockethub/data-layer](packages/data-layer)
* [@sockethub/examples](packages/examples)
* [@sockethub/irc2as](packages/irc2as)
* [@sockethub/platform-dummy](packages/platform-dummy)
* [@sockethub/platform-feeds](packages/platform-feeds)
* [@sockethub/platform-irc](packages/platform-irc)
* [@sockethub/platform-xmpp](packages/platform-xmpp)
* [@sockethub/schemas](packages/schemas)
* [@sockethub/server](packages/server)

## Credits

Project created and maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/res/img/nlnet-logo.svg)](http://nlnet.nl)
