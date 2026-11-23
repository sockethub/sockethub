# Sockethub Examples

Interactive pages that send
[ActivityStreams 2.0](https://www.w3.org/TR/activitystreams-core/) messages to
the Sockethub server this app was loaded from.

## Layout

The home page catalogs the examples. Once the service descriptor has loaded, a
card whose platform is missing from it is greyed out. The sidebar keeps every
link disabled until that answer arrives (the hint is "Checking server…").
Afterward a missing platform is labeled "off". If discovery fails, every
sidebar link stays disabled and is labeled "off".

Each example is a sequence of numbered steps. A later step stays locked, or
shows what is missing, until the earlier step has succeeded. On a wide screen
the activity log sits beside the steps. On a narrow screen it sits below them,
and a dismissible pill under the header reports the latest request or reply.

Desktop uses a sidebar. Below the `lg` breakpoint (1024px) a menu button opens
a dialog drawer. The drawer closes when the route changes, on Escape, and when
the viewport crosses back to desktop.

## What the examples demonstrate

1. Connect with `SockethubClient` and wait for `ready()` (schema registry loaded).
2. Build `@context` with `sc.contextFor('platform')` from server metadata.
3. Put an **actor** on each activity (`id`, `type`, and `name` where the page asks).
4. Send **credentials** on their own event, then **connect**, **join**, **send**,
   **fetch**, or **query**. Credentials are not placed inside the activity.
5. Read the request and the reply in the activity log.

Feeds and metadata derive the actor from the URL, then you confirm that actor
before fetch. Chat examples (IRC, XMPP) walk through actor, credentials,
connect, join, and send. Email connects IMAP, SMTP, or both, then fetches or
sends. CalDAV offers a public `.ics` feed with no account, and an account path
that discovers calendars and creates an event or to-do. CardDAV discovers
address books, then lists, searches, adds, edits, and deletes contacts. Edits
and deletes send the contact's ETag. Messenger and Instagram set account
credentials, then send one text reply.

There is no example page for media, Web Push, or WhatsApp. Those platforms are
documented in their package READMEs.

## Platform examples

| Example | Route | Activities | Access |
|---------|-------|------------|--------|
| **Dummy** | `/dummy` | echo, greet, fail, throw | No account |
| **Feeds** | `/feeds` | fetch | No account. Actor type is `feed` |
| **Metadata** | `/metadata` | fetch | No account. Actor type is `website` |
| **IRC** | `/irc` | connect, join, send | No account |
| **XMPP** | `/xmpp` | connect, join, send | Your own account |
| **Email** | `/email` | connect, fetch, send | Your own account |
| **Messenger** | `/messenger` | send | Your own Facebook Page |
| **Instagram** | `/instagram` | send | Your own professional account |
| **CalDAV** | `/caldav` | fetch, create, read | Account, or a public feed |
| **CardDAV** | `/carddav` | fetch, query, create | Your own account |

## Prerequisites

- Sockethub server (from repo root: `bun run dev` serves examples at
  `http://localhost:10550/examples`)
- Redis (required by the server)

## Run standalone (optional)

```bash
cd packages/examples
bun install
bun run dev
```

The app discovers the server's endpoints from the origin it was loaded from.
When running standalone on the Vite dev server, point it at a running Sockethub
with `VITE_SOCKETHUB_URL=http://localhost:10550 bun run dev`.

## Code layout

- `src/lib/examples.ts` — the catalog: groups, routes, activities, and access notes
- `src/lib/sockethub.ts` — shared client, `ensureClientReady()`, `contextFor()`, `send()`
- `src/lib/api-discovery.ts` — service descriptor used to enable or disable pages
- `src/components/BaseExample.svelte` — page header, steps, and the activity log
- `src/components/Step.svelte` — one numbered step, including locked and blocked states
- `src/components/Nav.svelte` — sidebar and drawer links
- `src/routes/+layout.svelte` — desktop sidebar and the mobile navigation dialog

## Troubleshooting

**Send fails before ready** — Wait for the socket `ready` event or call
`await sc.ready()` before building messages (the example `send()` helper does this).

**A page is marked off** — That platform is not in this server's `platforms`
list. Enable it in `sockethub.config.json` and restart.

**IRC connects with TLS even if you change the port** — The page always sends
`secure: true` (the default port is 6697). Editing the port does not turn TLS
off, so a plaintext server on 6667 will not connect from this page.

## Learn more

- [Client Guide](../../docs/client-guide.md)
- [Getting Started](../../docs/getting-started.md)
- [ActivityStreams specification](https://www.w3.org/TR/activitystreams-core/)
