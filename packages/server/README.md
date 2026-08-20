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
platform instance — but never because they named the same actor.

Instance selection:

- A persistent instance is keyed on the platform, the actor, and a
  server-derived scope.
- Credentials with a non-empty `password` or `token` (e.g. IRC OAuth) scope the
  instance by a fingerprint of the submitted credential object, so two sockets
  share an instance only when their credentials are identical.
- Credentials with neither are treated as anonymous and scoped to the session,
  so they are never shared across sockets.
- A client that knows or guesses an `actor.id` cannot select another session's
  instance, and cannot tell whether one exists: it takes the same path as a
  fresh connect and receives the remote protocol's own error.

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

`$ npm install -g @sockethub/server`

## Running

Sockethub runs on Node.js:

`$ LOG_LEVEL=debug npx @sockethub/server`

### Environment Variables

- PORT

Default: `10550`

- HOST

Default: `localhost`

- LOG_LEVEL

Console log level: `error`, `warn`, `info` (default), or `debug`. Set to
`debug` to print all Sockethub debug statements. See also `LOG_FILE_LEVEL` and
`LOG_FILE`.

- REDIS_PORT

Default: `6379`

- REDIS_HOST

Default: `localhost`

***OR***

- REDIS_URL

Overrides `REDIS_HOST` and `REDIS_PORT`, can specify a full redis connect URL
(e.g. `redis://username:password@host:port`)

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

#### Sentry Observability

Sentry error reporting can be configured via environment variable or config file:

**Environment Variables:**

- `SENTRY_DSN` - enable Sentry
- `SENTRY_ENVIRONMENT` - deployment name such as `production`
- `SENTRY_RELEASE` - deployed release identifier

**Config File:**
For more advanced Sentry configuration, add a `sentry` section to your
`sockethub.config.json`:

```json
{
  "sentry": {
    "dsn": "https://your-dsn@sentry.io/project-id",
    "environment": "production",
    "enableLogs": true,
    "logLevels": ["warn", "error"],
    "enableMetrics": true,
    "tracesSampleRate": 0.1,
    "profileSessionSampleRate": 0.01,
    "sendDefaultPii": false
  }
}
```

When configured, the server reports errors plus aggregate connection/action
metrics and traces. Logs are opt-in. Profiling is disabled when its sample rate
is zero. Run `sockethub --sentry-test --config /path/to/config.json` to send a
verification event and exit.

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

`$ LOG_LEVEL=debug bin/sockethub --examples`

You should then be able to browse to `http://localhost:10550/examples` and try
out the examples.

For production, with examples disabled.

`$ LOG_LEVEL=debug bin/sockethub`

## License

Sockethub is licensed under the
[LGPL](https://github.com/sockethub/sockethub/blob/master/LICENSE)

## Credits

Project created and maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/res/img/nlnet-logo.svg)](http://nlnet.nl)
