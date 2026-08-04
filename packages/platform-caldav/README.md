# `@sockethub/platform-caldav`

Sockethub platform for discovering CalDAV calendars and reading, creating,
updating, and deleting events (`VEVENT`) and tasks (`VTODO`).

Requests accept only public HTTPS services by default. Administrators can opt
in to HTTP with `packageConfig.allowInsecureHttp` and private-network targets
with `packageConfig.allowPrivateAddresses`; these are server settings and
cannot be enabled by a connected client. Credentials and OAuth tokens are sent
only to the configured origin. Every calendar and item target is checked
against the authenticated account before it is used.

## Authentication

Send credentials using either a username and password (normally an app
password) or an OAuth access token obtained by the application. Username and
password credentials negotiate HTTP Digest (MD5 or SHA-256, including the
`-sess` variants) or Basic authentication from the server's challenge. Digest
supports `qop=auth`; unsupported challenge modes are rejected. Sockethub uses
the token as an HTTP Bearer token; it does not run an OAuth authorization UI.

```json
{
  "type": "credentials",
  "actor": { "id": "caldav:alice", "type": "person" },
  "object": {
    "type": "credentials",
    "url": "https://calendar.example/dav/",
    "token": "oauth-access-token"
  }
}
```

For Basic authentication, replace `token` with `username` and `password`. The
URL can be a service root; discovery also tries `/.well-known/caldav`.
Cross-origin redirects are rejected, so configure the provider's final CalDAV
origin when its discovery URL redirects elsewhere.

## Actions

- `fetch`: discover calendars and their event/task support.
- `query`: read items from one discovered calendar, optionally filtering by
  component type or UTC date range.
- `create`: create an event or task with collision protection.
- `update`: replace an item only when its ETag still matches.
- `delete`: delete an item only when its ETag still matches.

Use `sc.contextFor("caldav")` for `@context` and pass an acknowledgement
callback for each message.

### Discover calendars

```json
{
  "type": "fetch",
  "actor": { "id": "caldav:alice", "type": "person" }
}
```

The collection contains calendar objects such as:

```json
{
  "id": "https://calendar.example/calendars/alice/personal/",
  "type": "calendar",
  "name": "Personal",
  "color": "#3a87ad",
  "components": ["event", "task"]
}
```

### Query items

```json
{
  "type": "query",
  "actor": { "id": "caldav:alice", "type": "person" },
  "target": {
    "id": "https://calendar.example/calendars/alice/personal/",
    "type": "calendar"
  },
  "object": {
    "type": "event",
    "startTime": "2026-08-01T00:00:00Z",
    "endTime": "2026-09-01T00:00:00Z"
  }
}
```

Each returned item contains its resource `id`, `uid`, `etag`, and
`updateSupported`. Keep the ETag for later update or delete requests. Use date
ranges for large calendars; responses larger than 10 MiB are rejected.

### Create an event

```json
{
  "type": "create",
  "actor": { "id": "caldav:alice", "type": "person" },
  "target": {
    "id": "https://calendar.example/calendars/alice/personal/",
    "type": "calendar"
  },
  "object": {
    "type": "event",
    "name": "Project planning",
    "startTime": "2026-08-03T15:00:00",
    "endTime": "2026-08-03T16:00:00",
    "timeZone": "Europe/Prague",
    "recurrence": {
      "frequency": "weekly",
      "count": 4,
      "byDay": ["MO"]
    },
    "organizer": {
      "email": "alice@example.com",
      "name": "Alice"
    },
    "attendees": [
      {
        "email": "bob@example.com",
        "role": "required",
        "rsvp": true
      }
    ],
    "reminders": [{ "trigger": "-PT15M", "action": "display" }],
    "attachments": [
      {
        "url": "https://example.com/agenda.pdf",
        "mediaType": "application/pdf"
      }
    ]
  }
}
```

Timed values use RFC 3339 with a UTC offset, or a local date-time plus an IANA
`timeZone`. All-day values use `YYYY-MM-DD`; an event's end date is exclusive.
Named time zones include a `VTIMEZONE` definition generated from the server's
IANA timezone data.
The optional `uid` field must not contain `%`, `/`, or `\`; omit it to let
Sockethub generate a safe UID.
Attachments can use a URL or base64 `data`. Email reminders additionally need
a `recipients` array. Tasks support `due`, `status`, `completedTime`, and
`percentComplete`.

### Update and delete

Update sends the complete event or task returned by `query`, including `id`,
`uid`, and `etag`. Increment `sequence` when changing scheduling information.
An update is rejected when `updateSupported` is false, which protects recurrence
exceptions, exclusion dates, and multi-component resources from being lost.
Properties outside Sockethub's item model, such as `CATEGORIES` and `X-`
properties, are not preserved when an otherwise supported item is updated.

```json
{
  "type": "delete",
  "actor": { "id": "caldav:alice", "type": "person" },
  "target": {
    "id": "https://calendar.example/calendars/alice/personal/",
    "type": "calendar"
  },
  "object": {
    "id": "https://calendar.example/calendars/alice/personal/item.ics",
    "type": "event",
    "etag": "\"server-version\""
  }
}
```

If another client changed the item, update/delete returns `caldav:conflict`.
Query again, reconcile the change, and retry with the new ETag.

## Interoperability and security

The implementation follows WebDAV/CalDAV discovery, calendar-query REPORT,
iCalendar content-line escaping/folding, and conditional PUT/DELETE semantics.
The integration suite exercises the complete event and VTODO lifecycle against
Radicale with Basic authentication and Baikal with Digest authentication.
Provider-specific OAuth authorization and token refresh remain the calling
application's responsibility, because Sockethub receives credentials only after
authorization.

Queries currently return calendar snapshots. CalDAV sync tokens (RFC 6578) are
the intended follow-up for efficient incremental synchronization.

Stable errors include `caldav:authentication-failed`,
`caldav:unsupported-authentication`,
`caldav:connection-failed`, `caldav:invalid-calendar`,
`caldav:invalid-resource`, `caldav:unsupported-component`,
`caldav:conflict`, and `caldav:not-found`.
