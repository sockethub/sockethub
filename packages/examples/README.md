# Sockethub Examples

Interactive web examples showing how client applications talk to Sockethub using
[ActivityStreams 2.0](https://www.w3.org/TR/activitystreams-core/) messages.

## What the examples demonstrate

1. Connect with `SockethubClient` and wait for `ready()` (schema registry loaded).
2. Build `@context` with `sc.contextFor('platform')` from server metadata.
3. Define a local **actor** object (`id`, `type`, `name`) in the UI — not registered on the server.
4. Send **credentials**, then **connect** / **join** / **send** (or **fetch**) with full
   actor objects on every event.
5. Inspect request/response JSON in the ActivityStreams logger.

There is no `activity-object` event and no `Object.create()` shorthand registry.
String-only `actor` ids are normalized to `{ id }` by the client, but the examples
use explicit actor objects so `type` and `name` are always present on the wire.

## Platform examples

| Example | Purpose |
|---------|---------|
| **Dummy** | Echo, fail, throw, greet — learn message shape |
| **Feeds** | Fetch RSS/Atom by URL |
| **IRC** | Credentials → connect → join → send |
| **XMPP** | Same flow for multi-user chat |
| **Metadata** | Extract Open Graph / page metadata from a URL |

## Prerequisites

- Sockethub server (from repo root: `bun run dev` serves examples at `http://localhost:10550`)
- Redis (required by the server)

## Run standalone (optional)

```bash
cd packages/examples
bun install
bun run dev
```

Point the app at a running Sockethub by editing `static/config.json` or using the
default `localhost:10550`.

## Code layout

- `src/lib/sockethub.ts` — shared client, `ensureClientReady()`, `contextFor()`, `send()`
- `src/components/ActivityActor.svelte` — confirm actor JSON for the session (app-local)
- `src/components/Credentials.svelte` — credentials event
- `src/components/chat/*` — join room and send messages (IRC/XMPP)

## Troubleshooting

**`contextFor` / send fails before ready** — Wait for the socket `ready` event or call
`await sc.ready()` before building messages (the example `send()` helper does this).

**Platform not available** — Enable the platform in `sockethub.config.json` and check server logs.

## Learn more

- [Client Guide](../../docs/client-guide.md)
- [Getting Started](../../docs/getting-started.md)
- [ActivityStreams specification](https://www.w3.org/TR/activitystreams-core/)
