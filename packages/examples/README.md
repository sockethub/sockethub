# Sockethub Examples

Interactive web examples showing how client applications talk to Sockethub using
[ActivityStreams 2.0](https://www.w3.org/TR/activitystreams-core/) messages.

## What the examples demonstrate

1. Connect with `SockethubClient` and wait for `ready()` (schema registry loaded).
2. Build `@context` with `sc.contextFor('platform')` from server metadata.
3. Set an **actor** object (`id`, `type`, `name`) where the platform needs one.
4. Send **credentials**, **connect**, **join**, **send**, or **fetch** with the actor on each event.
5. Inspect request/response JSON in the ActivityStreams logger.

Fetch-only examples (feeds, metadata) build the actor from the URL field. Chat
examples (IRC, XMPP) walk through credentials, connect, join, and send.

## Platform examples

| Example | Purpose |
|---------|---------|
| **Dummy** | Echo, fail, throw, greet — learn message shape |
| **Feeds** | Fetch RSS/Atom by URL (`actor.type` is `feed`) |
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
- `src/components/ActivityActor.svelte` — actor JSON for chat examples (IRC, XMPP, dummy)
- `src/components/Credentials.svelte` — credentials event
- `src/components/chat/*` — join room and send messages (IRC/XMPP)

## Troubleshooting

**Send fails before ready** — Wait for the socket `ready` event or call
`await sc.ready()` before building messages (the example `send()` helper does this).

**Platform not available** — Enable the platform in `sockethub.config.json` and check server logs.

## Learn more

- [Client Guide](../../docs/client-guide.md)
- [Getting Started](../../docs/getting-started.md)
- [ActivityStreams specification](https://www.w3.org/TR/activitystreams-core/)
