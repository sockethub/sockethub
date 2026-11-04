# `@sockethub/platform-instagram`

Outgoing text messages through Meta's Instagram API. This is a stateless,
authenticated platform: set credentials, then send. No connect action or webhook
endpoint is needed. Incoming messages and recipient discovery are external.

## Setup

The Sockethub CLI bundles this platform. For a custom server installation, install
`@sockethub/platform-instagram` and include it in your config's `platforms` list
alongside the other platforms you use. Node.js >= 20 and Redis >= 6 are required.

Use an Instagram Login access token with `instagram_business_manage_messages`. The actor ID is your
Instagram professional account ID; the target ID is the recipient's Instagram-scoped ID (IGSID),
obtained through your external incoming-message integration. A username, phone
number, or ID scoped to a different app/account is not a substitute.

Instagram Login is the default: omit `login` or set `login: 'instagram'` and
use the professional account ID as `actor.id`.

For Facebook Login, supply a Page access token with `instagram_manage_messages`,
set `login: 'facebook'` and `pageId: '<LINKED_PAGE_ID>'` in the credential object.
Keep the Instagram professional account ID as `actor.id`. Sends then use
`graph.facebook.com/{apiVersion}/{pageId}/messages`; Instagram Login sends use
`graph.instagram.com/{apiVersion}/{actor.id}/messages`.
The login method is explicit: tokens are never inspected or guessed.

Create a Meta developer app, add the messaging use case, connect your account,
and use app-role/tester accounts for a private development-mode proof of concept.
Public use and Human Agent access depend on Meta permissions and review; owning
the account does not remove those requirements. Obtain tokens outside Sockethub.

## Examples app

Run `bun run dev` and open `/examples/instagram` on the Sockethub server.
Enter your account ID, access token, Graph API version, and scoped recipient ID
to send a text reply. Human Agent tagging is optional and off by default.

## Usage

This server-side JavaScript example uses runtime environment variables. In a
browser, obtain credentials through your application's secure runtime flow.
Choose a supported Graph API version enabled for your Meta app explicitly.

```javascript
import SockethubClient from '@sockethub/client';

const sc = await SockethubClient.connect('http://localhost:10550');
await sc.ready();
const actor = { id: process.env.META_ACCOUNT_ID, type: 'person' };

sc.socket.emit('credentials', {
  '@context': sc.contextFor('instagram'),
  type: 'credentials',
  actor,
  object: {
    type: 'credentials',
    token: process.env.META_ACCESS_TOKEN,
    apiVersion: process.env.META_API_VERSION
  }
}, (ack) => {
  if (ack?.error) {
    console.error(ack.error);
    return;
  }
  sc.socket.emit('message', {
    '@context': sc.contextFor('instagram'),
    type: 'send',
    actor,
    target: { id: process.env.META_RECIPIENT_ID, type: 'person' },
    object: { type: 'message', content: 'Hello from Sockethub!' }
  }, (result) => {
    if (result?.error) {
      console.error(result.error);
      return;
    }
    // A successful send returns the original activity with object.id set to
    // Meta's message ID. This confirms API acceptance, not delivery or reading.
    console.log(result.object?.id);
  });
});

// On explicit logout or when switching users, clear the client-side replay
// state and disconnect. Credentials already stored for this server session
// stay usable until the socket disconnects; a new connection starts a fresh
// session that cannot reach them.
// sc.clearCredentials();
// sc.socket.disconnect();
```

## Limits and failures

- Text only, up to 1000 bytes of UTF-8 per message (Meta's limit is in bytes,
  so non-ASCII text allows fewer characters). Oversized text is rejected
  before any request is made.
- Standard replies use Meta's normal messaging window. Sockethub does not track
  incoming messages or calculate eligibility; Meta enforces its policies.
- Set `object.humanAgent: true` only for an eligible manual support reply when
  your Meta app has Human Agent access. Instagram Login uses `human_agent`;
  Facebook Login uses `HUMAN_AGENT` with `messaging_type: MESSAGE_TAG`.
  Standard Facebook Login replies use `messaging_type: RESPONSE`, without a tag.
  It does not grant access, verify human authorship, or restart the window.
- Meta error code `10` with subcode `2018278` or `2534022` returns the stable
  marker `meta:messaging-window-closed` followed by the original diagnostic details.
  Clients can recognise this marker in the acknowledgement's `error` string;
  permission failures are not classified as window failures.
- Meta failures return the HTTP status, error code/subcode, and error message.
  Requests time out after 15 seconds. There are no platform-level retries:
  after a network timeout, delivery is unknown, so retrying may duplicate a send.
- No inbound messages, delivery/read receipts, OAuth onboarding, attachments,
  conversation history, or webhook hosting.

See [Meta's Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-1ff01566-3509-48bd-a0f4-8571a91ccfdf)
for access requirements and the underlying API.

API contract references:

- [Meta error codes](https://developers.facebook.com/docs/messenger-platform/error-codes/)
- [Instagram Login sends](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api)
- [Facebook Login Instagram sends](https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message/)
- [Meta Human Agent feature](https://developers.facebook.com/docs/features-reference/human-agent)

Automated tests validate request construction and error mapping, not account
permissions or delivery. Meta's send guides do not provide a complete Human Agent
wire example for both login routes; tag acceptance remains a deployment check.

To check Gigger's actual adapter against these schemas and platform handlers,
run from the Sockethub repository root:

```sh
GIGGER_ROOT=/path/to/gigger bun run integration:gigger
```

This starts a local Socket.IO test server, validates the real adapter's activities,
and intercepts outbound Meta requests. It needs the corresponding Gigger adapter
changes; it never sends messages to Meta or requires account credentials.
