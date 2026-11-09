# `@sockethub/platform-carddav`

Sockethub platform for discovering CardDAV address books and searching,
creating, updating, and deleting vCard contacts.

The platform accepts public HTTPS services by default. Administrators may opt
in to HTTP or private-network services with `allowInsecureHttp` and
`allowPrivateAddresses`. Address checks use the shared outbound URL guard,
including IPv6 embeddings of private ranges and the local-use NAT64 prefix
`64:ff9b:1::/48`. See
[Outbound URL guard](../../docs/configuration.md#outbound-url-guard).
Authentication supports Basic, Digest, or a caller-provided Bearer token
through the standard Sockethub credentials flow.

## Discovery cache

Each `query`, `sync`, `create`, `update`, and `delete` needs the account's address book list to
check the target. The platform caches that discovery result in memory for
`packageConfig.discoveryCacheTtlMs` (default `300000`, 5 minutes; `0`
disables the cache). Entries are keyed by an HMAC of the protocol, service URL,
and credentials. The HMAC uses a per-process random secret, and only
collection metadata is stored. A `fetch` always discovers fresh. Within the TTL,
an address book added on the server is not visible to targeted actions, and a removed
one is still accepted as a target (the server then rejects the request). An
authentication, not-found, or unknown-address-book error drops the entry, so the next
request rediscovers. The cache is lost when the platform process restarts.

## Authentication

Send credentials before performing CardDAV actions. Use either a username and
password (normally an app password) or a Bearer token obtained by the
application.

```json
{
  "type": "credentials",
  "actor": { "id": "carddav:alice", "type": "person" },
  "object": {
    "type": "credentials",
    "url": "https://contacts.example/dav/",
    "username": "alice",
    "password": "app-password"
  }
}
```

For Bearer authentication, replace `username` and `password` with `token`. The
URL may be a service root; Sockethub discovers the account's address books from
that endpoint.

## Actions

- `fetch`: discover address books.
- `query`: list or search contacts.
- `sync`: report what changed in one address book since a sync token
  (RFC 6578 WebDAV Sync).
- `create`: create a vCard with collision protection.
- `update`: update a vCard only when its ETag still matches.
- `delete`: delete a vCard only when its ETag still matches.

Use `sc.contextFor("carddav")` as the request context.

### Discover address books

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/carddav/v1.jsonld"
  ],
  "type": "fetch",
  "actor": { "id": "carddav:alice", "type": "person" }
}
```

### Search contacts

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/carddav/v1.jsonld"
  ],
  "type": "query",
  "actor": { "id": "carddav:alice", "type": "person" },
  "target": {
    "id": "https://contacts.example/addressbooks/alice/personal/",
    "type": "addressBook"
  },
  "object": {
    "type": "contactQuery",
    "text": "Bob",
    "fields": ["name", "email"],
    "limit": 50
  }
}
```

### Sync changes

`sync` reports changes without listing the whole address book each time. Send
it without an `object` for the initial sync, which returns every contact and a
`syncToken`:

```json
{
  "type": "sync",
  "actor": { "id": "carddav:alice", "type": "person" },
  "target": {
    "id": "https://contacts.example/addressbooks/alice/personal/",
    "type": "addressBook"
  }
}
```

The response is a collection with `items` (contacts in the same shape as
`query` results), `removed` (ids of contacts deleted since the token),
`syncToken`, and `truncated`. Store the token as an opaque string per address
book and send it back as `"object": { "syncToken": "..." }` to receive only
what changed since then. When `truncated` is `true`, store the new token and
sync again until it is `false`.

On `carddav:sync-token-invalid`, drop the stored token and sync again without
one. On `carddav:sync-unsupported`, the server does not offer WebDAV Sync; fall
back to `query`. Other sync errors are `carddav:sync-failed`. A server that
rejects a token without a `DAV:` precondition (a 400, 409, or 412) is
reported as `carddav:sync-token-invalid`, so a retry without a token reports
the real cause.

### Create a contact

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/carddav/v1.jsonld"
  ],
  "type": "create",
  "actor": { "id": "carddav:alice", "type": "person" },
  "target": {
    "id": "https://contacts.example/addressbooks/alice/personal/",
    "type": "addressBook"
  },
  "object": {
    "type": "person",
    "name": "Bob Example",
    "givenName": "Bob",
    "familyName": "Example",
    "emails": [
      { "value": "bob@example.com", "types": ["work"], "preferred": true }
    ],
    "photoUrls": ["https://example.com/bob.jpg"]
  }
}
```

Update sends the complete contact returned by `query`, including `id`, `uid`,
and `etag`. The server re-fetches the current vCard using that ETag before
writing. Unknown properties and parameters from the authoritative stored card
are retained, preventing an application from accidentally erasing data it does
not understand.

Only HTTP(S) `PHOTO` URIs appear as `photoUrls`. CardDAV never downloads those
images. Existing inline photos are hidden from responses and preserved during
updates. Supplying `photoUrls` explicitly replaces all stored photos; an empty
array removes them.

The initial implementation reads vCard 3.0 and 4.0 and writes vCard 4.0. Stable
errors use the `carddav:` prefix, including `authentication-failed`,
`unsupported-authentication`, `invalid-address-book`, `invalid-resource`,
`conflict`, `not-found`, `unsupported-update`, `sync-token-invalid`,
`sync-unsupported`, and `sync-failed`.
