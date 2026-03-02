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

#### HTTP Actions

Enable the HTTP streaming endpoint and tune limits:

- SOCKETHUB_HTTP_ACTIONS_ENABLED
- SOCKETHUB_HTTP_ACTIONS_PATH
- SOCKETHUB_HTTP_ACTIONS_REQUIRE_REQUEST_ID
- SOCKETHUB_HTTP_ACTIONS_MAX_MESSAGES_PER_REQUEST
- SOCKETHUB_HTTP_ACTIONS_MAX_PAYLOAD_BYTES
- SOCKETHUB_HTTP_ACTIONS_IDEMPOTENCY_TTL_MS
- SOCKETHUB_HTTP_ACTIONS_REQUEST_TIMEOUT_MS
- SOCKETHUB_HTTP_ACTIONS_IDLE_TIMEOUT_MS

Request handling stays on Sockethub's existing core path:

- validate message shape
- store credentials (when applicable)
- enqueue to Redis
- process in platform child process
- stream each result line back to the HTTP client

HTTP actions only change transport and replay behavior. They do not create a
separate platform routing model.

See [`docs/configuration.md`](../../docs/configuration.md) for details and examples.

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
