# @sockethub/server

## About

The core Sockethub server package that handles client connections, manages platform
instances, and orchestrates message routing between web clients and protocol platforms.

This package can be used independently if you want to build a custom Sockethub
deployment or integrate server functionality into your own application. For a complete
setup with all platforms and dependencies, use the main `sockethub` package instead.

## Architecture

The server implements:

- **Socket.IO Connection Management**: Handles web client connections and real-time communication
- **Platform Instance Management**: Spawns and manages child processes for each protocol platform
- **Job Queue Integration**: Uses Redis and BullMQ for reliable message queuing
- **Middleware Pipeline**: Extensible request processing including validation and credential storage
- **Session Management**: Per-connection credential isolation and state management
- **Error Reporting**: Optional Sentry integration for production error monitoring and debugging

## Credential Session Sharing

For persistent platforms, Sockethub may attach multiple sockets to one running
platform instance when they target the same actor.

Session sharing rules:

- Credentials are validated in the data layer during share attempts.
- Share is allowed only when credentials include a non-empty `password`.
- Username-only/anonymous credentials are rejected with `username already in use`.

Reconnect exception for anonymous credentials:

- If a prior socket for that actor is stale (already disconnected) and
  the reconnect IP matches, Sockethub allows reconnect during janitor grace.
- IP source is configurable with:
  - `credentialCheck.reconnectIpSource` (`socket` default, or `proxy`)
  - `credentialCheck.proxyHeader` (`x-forwarded-for` default)

## Documentation

For complete Sockethub documentation, see the [main repository README](../../README.md)
and [Sockethub wiki](https://github.com/sockethub/sockethub/wiki).

## Install

`$ bun install -g @sockethub/server`

## Running

`$ DEBUG=sockethub* bunx @sockethub/server`

### Environment Variables

- PORT

Default: `10550`

- HOST

Default: `localhost`

- DEBUG

Specify the namespace to console log, e.g. `sockethub*` will print all sockethub
related debug statements, whereas `*` will also print any other modules debug
statements that use the `debug` module.

- REDIS_PORT

Default: `6379`

- REDIS_HOST

Default: `localhost`

***OR***

- REDIS_URL

Overrides `REDIS_HOST` and `REDIS_PORT`, can specify a full redis connect URL
(eq. `redis://username:password@host:port`)

#### Sentry Configuration

Sentry error reporting can be configured via environment variable or config file:

**Environment Variable:**

- SENTRY_DSN - Set this to enable basic Sentry error reporting

**Config File:**
For more advanced Sentry configuration, add a `sentry` section to your
`sockethub.config.json`:

```json
{
  "sentry": {
    "dsn": "https://your-dsn@sentry.io/project-id",
    "environment": "production",
    "traceSampleRate": 1.0
  }
}
```

When configured, the server automatically reports errors to Sentry for monitoring and
debugging in production environments.

### Command-line params

```
  --help       : this help screen
  --info       : displays some basic runtime info

  --examples   : enabled examples page and serves helper files like jquery

  --host       : hostname to bind to
  --port       : port to bind to
```

### Start

Run with debug output and examples enabled:

`$ DEBUG=sockethub* bin/sockethub --examples`

You should then be able to browse to `http://localhost:10550/examples` and try
out the examples.

For production, with examples disabled.

`$ DEBUG=sockethub* bin/sockethub`

## License

Sockethub is licensed under the
[LGPL](https://github.com/sockethub/sockethub/blob/master/LICENSE)

## Credits

Project created and maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/res/img/nlnet-logo.svg)](http://nlnet.nl)
