# `@sockethub/platform-carddav`

Sockethub platform for discovering CardDAV address books and searching,
creating, updating, and deleting vCard contacts.

The platform accepts public HTTPS services by default. Administrators may opt
in to HTTP or private-network services with `allowInsecureHttp` and
`allowPrivateAddresses`. Authentication supports Basic, Digest, or a
caller-provided Bearer token through the standard Sockethub credentials flow.

## Actions

- `fetch`: discover address books.
- `query`: list or search contacts.
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
`conflict`, `not-found`, and `unsupported-update`.
