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

### Authentication compatibility

<!-- markdownlint-disable MD013 -->

| Method | Status | Details |
| --- | --- | --- |
| HTTP Basic | Supported | Negotiated from the server challenge. Use only over HTTPS outside a controlled test network. |
| HTTP Digest | Supported | `MD5`, `MD5-sess`, `SHA-256`, and `SHA-256-sess`, with no `qop` or with `qop=auth`. Stale nonces are refreshed once. |
| OAuth Bearer | Supported with caller-provided token | Sockethub sends the supplied token as an HTTP Bearer token. Token acquisition, refresh, scopes, and provider consent remain the application's responsibility. |
| Digest `qop=auth-int` | Not supported | CalDAV request bodies are not included in Digest authentication hashes. |
| Digest `SHA-512-256` or `userhash` | Not supported | A server offering only these modes returns `caldav:unsupported-authentication`. |
| OAuth authorization or token refresh | Not supported | There is no provider-specific OAuth flow or token store in this platform. |
| Client TLS certificates | Not supported | Credentials cannot currently select a client certificate or private key. |
| Negotiate/Kerberos, NTLM | Not supported | These connection- and deployment-specific schemes are not implemented. |

<!-- markdownlint-enable MD013 -->

When a username and password are supplied, Sockethub sends no credentials until
the server challenges it, prefers a supported Digest challenge, and otherwise
uses Basic when offered. A Bearer token is sent directly. Authentication is
never forwarded to another origin.

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

### Server and provider compatibility

"Supported" below means the listed configuration has been exercised. Other
standards-compliant CalDAV servers may work, but are not considered verified
until they are included in automated or repeatable manual testing.

<!-- markdownlint-disable MD013 -->

| Service | Deployment | Verification | Authentication exercised | Notes |
| --- | --- | --- | --- | --- |
| Radicale 3.7.7 | Self-hosted | Automated integration | Basic | Complete discovery and event/task create, query, update, and delete lifecycle. |
| Baïkal 0.10.1 | Self-hosted | Automated integration | Digest MD5 with `qop=auth` | Complete lifecycle through Baïkal's `dav.php/` endpoint, including its encoded ETags. |
| Nextcloud | Self-hosted or hosted | Manually verified during initial development | Basic with username and password or app password | Use the final `/remote.php/dav/` endpoint when cross-origin discovery redirects are involved. OAuth is not covered by this verification. |
| ownCloud | Self-hosted or hosted | Not yet verified | Not yet verified | Expected to work when standard discovery and a supported authentication method are enabled. |
| DAViCal | Self-hosted | Not yet verified | Not yet verified | Expected to work when standard discovery and a supported authentication method are enabled. |
| SOGo | Self-hosted | Not yet verified | Not yet verified | Expected to work when standard discovery and a supported authentication method are enabled. |
| iCloud, Google Calendar, Fastmail, and other hosted providers | Hosted | Not yet verified | Provider-dependent | Provider-specific discovery, application passwords, OAuth scopes, or account policies may require additional work. |

<!-- markdownlint-enable MD013 -->

Private-network and plain HTTP servers are rejected by default. A Sockethub
administrator must explicitly enable `allowPrivateAddresses` or
`allowInsecureHttp`; a connected application cannot weaken these policies.

### CalDAV feature coverage

<!-- markdownlint-disable MD013 -->

| Capability | Status | Notes |
| --- | --- | --- |
| Principal and calendar-home discovery | Supported | Uses `current-user-principal`, `calendar-home-set`, and `/.well-known/caldav` fallback. Redirects must remain on the configured origin. |
| Calendar listing | Supported | Discovers accessible calendars in the user's calendar home and their advertised `VEVENT`/`VTODO` component support. |
| Events and tasks | Supported | Reads and writes `VEVENT` and `VTODO`. `VJOURNAL` and other component types are not supported. |
| Calendar queries | Supported | Supports component and UTC time-range filters. Without a range, a query returns a calendar snapshot. |
| Conditional create, update, and delete | Supported | Uses ETags with `If-None-Match` and `If-Match` to prevent accidental overwrites. |
| Recurrence | Partially supported | Common recurrence rules are parsed and generated. Resources with recurrence exceptions, exclusion dates, or multiple primary components are readable but rejected for update when rewriting could lose data. |
| Scheduling data | Partially supported | Organizer and attendee properties are represented, but CalDAV scheduling inbox/outbox delivery, invitation responses, and server-side email are not implemented. |
| Shared and delegated calendars | Read-only discovery only | Calendars returned from the user's calendar home can be queried, but creating shares, accepting invitations, proxy delegation, and ACL management are not implemented. |
| Calendar collection management | Not supported | The platform does not create, rename, or delete calendar collections. |
| Free/busy queries | Not supported | CalDAV free-busy REPORT and scheduling availability are not implemented. |
| Incremental sync | Not supported | WebDAV sync tokens (RFC 6578) are not used yet; queries return snapshots. |
| Managed attachments | Not supported | iCalendar URL and inline attachment properties are supported, but CalDAV managed attachments are not. |

<!-- markdownlint-enable MD013 -->

Queries currently return calendar snapshots. CalDAV sync tokens (RFC 6578) are
the intended follow-up for efficient incremental synchronization.

Stable errors include `caldav:authentication-failed`,
`caldav:unsupported-authentication`,
`caldav:connection-failed`, `caldav:invalid-calendar`,
`caldav:invalid-resource`, `caldav:unsupported-component`,
`caldav:conflict`, and `caldav:not-found`.
