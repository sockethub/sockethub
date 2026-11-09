# Email platform

`@sockethub/platform-email` receives mail through IMAP and submits outgoing mail
through SMTP. The mail server remains the message store. Sockethub keeps no
mailbox database and does not change read flags, move messages, or delete mail.

Requires Node.js >=20.19 and Redis through the Sockethub server.

Supported actions: `connect`, `disconnect`, `fetch`, `watch`, `unwatch`, `send`.
Each client session has its own worker and IMAP connection, so clients using the
same account can choose different folders and filters independently. Identical
passwords or tokens do not share that worker. Replacing the credential object
shuts this session's worker down; a send already in flight may have been
accepted. See
[Credential sharing](../../docs/configuration.md#credential-sharing-and-anonymous-reconnects).

## Connect

Enable `@sockethub/platform-email` in the server's `platforms` list if you use an
explicit configuration. The bundled default configuration includes it.

```javascript
await sc.ready();
const actor = { id: 'me@example.com', type: 'person', name: 'Example Sender' };
const context = sc.contextFor('email');

function emit(event, activity) {
  return new Promise((resolve, reject) => {
    sc.socket.emit(event, activity, (result) => {
      if (result?.error) reject(new Error(result.error));
      else resolve(result);
    });
  });
}

await emit('credentials', {
  '@context': context,
  type: 'credentials',
  actor,
  object: {
    type: 'credentials',
    from: 'me@example.com',
    imap: {
      host: 'imap.example.com',
      port: 993,
      secure: true,
      username: 'me@example.com',
      password: '<runtime app password>'
    },
    smtp: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      username: 'me@example.com',
      token: '<runtime OAuth access token>'
    }
  }
});
await emit('message', { '@context': context, type: 'connect', actor });
```

Configure IMAP, SMTP, or both. Every server needs its own username and exactly one
of `password` or `token`. Access tokens are supplied by your application; this
platform does not run authorization flows or refresh tokens. `from` is the sender
address used for outgoing mail, which the SMTP provider must authorize.

`secure: true` uses TLS immediately. `secure: false` requires STARTTLS; plaintext
credentials and invalid certificates are never accepted. IMAP defaults to TLS on
993, SMTP to STARTTLS on 587. SMTP port 465 implies immediate TLS unless overridden.

Private, loopback, and metadata server addresses are blocked by default. An
operator can allow a trusted private mail server with:

```json
{
  "packageConfig": {
    "@sockethub/platform-email": {
      "allowPrivateAddresses": true
    }
  }
}
```

The examples app includes an `/email` page for configuring an account, fetching,
watching, and sending. Credentials are entered at runtime.

## Fetch

```javascript
const page = await emit('message', {
  '@context': context,
  type: 'fetch',
  actor,
  object: {
    folders: ['INBOX', 'Orders'],
    from: ['friend@example.com'],
    to: ['me@example.com'],
    match: 'any',
    limit: 20
  }
});

// Repeat with the same folders and filters to fetch the next page.
const next = await emit('message', {
  '@context': context,
  type: 'fetch',
  actor,
  object: {
    folders: ['INBOX', 'Orders'],
    from: ['friend@example.com'],
    to: ['me@example.com'],
    match: 'any',
    limit: 20,
    cursors: page.cursors
  }
});
```

Responses are `collection` objects with `items`, per-folder `cursors`, and
`hasMore`. Merge returned cursors into the previous cursor map before requesting
another page: folders not visited in a page have no replacement cursor. Results
are ordered by increasing UID within each requested folder, visiting folders in
request order. There is no cross-folder date sort. Omit cursors to start from the
oldest messages; the default folder is `INBOX` and the default limit is 20 (max 50).

Address arrays match any listed address. `match: "any"` (default) means From OR To;
`match: "all"` means From AND To when both filters are present. Sockethub checks
parsed addresses case-insensitively after IMAP search, avoiding substring matches.
To refers to the visible To header, not BCC or the actual delivery envelope. A
matching From header does not establish sender authenticity.

Every item is a `post` activity: its actor is the sender, target is your account,
and object is a `message` containing `id`, `folder`, `uidValidity`, `uid`, `from`,
`to`, `cc`, `subject`, `messageId`, `inReplyTo`, `references` (an array of message
IDs), `published`, `content` (plain text), and optional `html`. Sender display
names are retained in `from` and the activity's `actor.name`. Treat returned HTML
as untrusted when rendering it.

`attachments` lists MIME part metadata as `{ filename?, contentType }`, including
named inline parts and nested attachments. An attachment without a filename is
still listed with its media type. Filenames and References are fetched separately
from the body, so they remain available when `bodyOmitted` is true. Attachment
contents are never returned.

A request examines up to 500 UID positions per folder and transfers up to 512 KiB
of source message data across the batch. A page can therefore be empty while
`hasMore` remains true; continue using its cursors. Messages larger than 256 KiB
are returned as metadata with `bodyOmitted: true`. Attachment contents are not returned.

The cursor combines UIDVALIDITY and the last scanned UID. Keep it tied to the
same mail server, account, and folder: UIDVALIDITY values can overlap across
accounts. The examples page resets pagination on connection changes.
If the server resets UIDVALIDITY, Sockethub rejects the cursor;
discard that folder's cursor and fetch again. The application owns any durable
cursor storage and duplicate handling. Reset cursors when changing filters.

If IMAP search fails, the acknowledgement is `email:search-failed; retry fetch`
and that folder's cursor stays put. A failed search is not an empty window: an
empty window advances the cursor across those UIDs. A `Date` header that is not
a date leaves `published` unset. The rest of that message, and the page, still
return.

## Watch

```javascript
sc.socket.on('message', (activity) => {
  // Check the email context before processing messages from a multi-platform client.
  if (activity['@context']?.some(value => value.includes('/platform/email/'))) {
    if (activity.error) console.error(activity.error);
    else if (activity.type === 'post') console.log(activity.object);
    else if (activity.type === 'watch') console.log(activity.object.cursor);
  }
});

await emit('message', {
  '@context': context,
  type: 'watch',
  actor,
  object: { folder: 'INBOX', to: ['me@example.com'] }
});

await emit('message', { '@context': context, type: 'unwatch', actor });
```

Watch observes one folder per client session, using IMAP IDLE with the library's
polling fallback. A new watch replaces the previous watch. It starts at the
current end of the folder unless `object.cursor` supplies a prior cursor for
catch-up. Filters have the same meaning as fetch. Progress arrives as `watch`
activities containing `{ type: "subscription", folder, cursor }`, including when
new messages do not match the filters. Fetching other folders temporarily pauses
the watch and then resumes it, catching up by UID.

Watching stops on connection loss and reports a `disconnect` activity with an
error. Explicitly reconnect and supply your saved cursor to fetch or watch again.
There is no background collection or exactly-once delivery guarantee. Mail moved
out of the watched folder before it can be fetched may not be observed.

## Send

```javascript
const submission = await emit('message', {
  '@context': context,
  type: 'send',
  actor,
  object: {
    to: ['friend@example.com'],
    subject: 'Hello',
    content: 'Hello from Sockethub!',
    inReplyTo: '<original-message@example.com>'
  }
});
console.log(submission.object.accepted, submission.object.rejected);
```

Send accepts `to`, optional `cc` and `bcc` arrays, `subject`, `content` (plain text),
`html`, `inReplyTo`, and a `references` array. The outgoing sender display name
comes from `actor.name` when provided. At least one body representation and
one To recipient are required. It returns a `send` activity with a `submission`
object containing `messageId`, `accepted`, `rejected`, and
`status: "accepted-by-server"`. Acceptance does not guarantee delivery; some
recipients can be rejected while others are accepted.

A failed submission can have an uncertain outcome if the connection drops after
the server accepts it. Do not automatically resend an uncertain submission. The
platform makes one submission attempt per action and disables stalled-job replay
after worker crashes, so uncertain sends are left for the application to resolve.
It does not save a Sent-folder copy.

On logout, disconnect and clear the client's replayed credentials:

```javascript
await emit('message', { '@context': context, type: 'disconnect', actor });
sc.clearCredentials({ platform: 'email', actorId: actor.id });
```

POP, folder mutations, flags, drafts, attachment transfers, provider OAuth
onboarding, and durable mailbox synchronization are outside this platform's scope.

## Development checks

After `bun install`, run `bun run --filter='@sockethub/platform-email' test` for
unit tests, including on a clean checkout. This runs the repository's shared
`build:foundations` preparation first; it does not build the whole monorepo.
Direct `bun test` assumes those dependencies have already been built.

After `bun run build`, run `bun run integration:email` for real IMAP fetch/watch
and SMTP send against local TLS test servers. That check requires `openssl` and
no external mail account.
