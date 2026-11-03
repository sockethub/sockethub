# `@sockethub/platform-instagram`

Outgoing text messages through Meta's Instagram API. This is a stateless,
authenticated platform: set credentials, then send. No connect action or webhook
endpoint is needed. Incoming messages and recipient discovery are external.

## Setup

The Sockethub CLI bundles this platform. For a custom server installation, install
`@sockethub/platform-instagram` and include it in your config's `platforms` list
alongside the other platforms you use. Node.js >= 20 and Redis >= 6 are required.

Use a Instagram Login access token with `instagram_business_manage_messages`. The actor ID is your
Instagram professional account ID; the target ID is the recipient's Instagram-scoped ID (IGSID),
obtained through your external incoming-message integration. A username, phone
number, or ID scoped to a different app/account is not a substitute.

This implementation uses Instagram Login (`graph.instagram.com`), not the Facebook Login API route.

Create a Meta developer app, add the messaging use case, connect your account,
and use app-role/tester accounts for a private development-mode proof of concept.
Public use and Human Agent access depend on Meta permissions and review; owning
the account does not remove those requirements. Obtain tokens outside Sockethub.

## Usage

This server-side JavaScript example uses runtime environment variables. In a
browser, obtain credentials through your application's secure runtime flow.
Choose a supported Graph API version enabled for your Meta app explicitly.

```javascript
import SockethubClient from '@sockethub/client';

const sc = await SockethubClient.connect('http://localhost:10550');
await sc.ready();
const actor = { id: process.env.META_ACCOUNT_ID, type: 'person' };

sc.socket.on('message', (activity) => {
  // A successful send returns the original activity with object.id set to
  // Meta's message ID. This confirms API acceptance, not delivery or reading.
  console.log(activity.object?.id);
});

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
    console.log(result.object?.id);
  });
});

// On explicit logout or when switching users:
// sc.clearCredentials();
```

## Limits and failures

- Text only, up to 1000 characters per message.
- Standard replies use Meta's normal messaging window. Sockethub does not track
  incoming messages or calculate eligibility; Meta enforces its policies.
- Set `object.humanAgent: true` only for an eligible manual support reply when
  your Meta app has Human Agent access. This explicitly adds `HUMAN_AGENT`;
  ordinary replies have no tag.
  It does not grant access, verify human authorship, or restart the window.
- Meta failures return the HTTP status, error code/subcode, and error message.
  Requests time out after 15 seconds. There are no platform-level retries:
  after a network timeout, delivery is unknown, so retrying may duplicate a send.
- No inbound messages, delivery/read receipts, OAuth onboarding, attachments,
  conversation history, or webhook hosting.

See [Meta's Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-1ff01566-3509-48bd-a0f4-8571a91ccfdf)
for access requirements and the underlying API.
