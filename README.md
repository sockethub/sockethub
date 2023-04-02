[![Sockethub](http://sockethub.org/res/img/sockethub-logo.svg)](http://sockethub.org)

A protocol gateway for the web.

[![Compliance](https://github.com/sockethub/sockethub/actions/workflows/compliance.yml/badge.svg)](https://github.com/sockethub/sockethub/actions/workflows/compliance.yml)
[![CodeQL](https://github.com/sockethub/sockethub/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/sockethub/sockethub/actions/workflows/codeql-analysis.yml)
[![Maintainability](https://api.codeclimate.com/v1/badges/95912fc801271faf44f6/maintainability)](https://codeclimate.com/github/sockethub/sockethub/maintainability)
[![Release](https://img.shields.io/npm/v/sockethub.svg?style=flat)](https://github.com/sockethub/sockethub/releases)

## About

*The monorepo for the Sockethub project.*

Sockethub is a translation layer for web applications to communicate with other protocols and services that are traditionally either inaccessible or impractical to use from in-browser JavaScript.

**For more information on Sockethub see the [Sockethub README](packages/server/README.md)**

## Run

To get up and running quickly, you only need the following commands:

```bash
$ pnpm install
$ pnpm dev
```

### Dependencies

```$ pnpm install```

### Build

```$ pnpm build```

### Tests

```$ pnpm test```

### Linter

```$ pnpm lint:js```

Or, to automatically fix linting errors:

```$ pnpm lint:fix```

### Integration Tests

```$ pnpm integration```

## Start

For development purposes, with examples enabled, run:

`$ DEBUG=sockethub* pnpm dev`

You should then be able to browse to `http://localhost:10550` and try out the examples.

For production, with examples disabled.

`$ DEBUG=sockethub* pnpm start`

*For more info on configuration options, see the
[Sockethub README](packages/server/README.md#environment-variables)*
section on environment variables.*

## Packages

* [@sockethub/activity-streams.js](packages/activity-streams.js)
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
