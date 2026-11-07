# `@sockethub/platform-whatsapp`

Outgoing text messages through the WhatsApp Business Cloud API. This is a
stateless, authenticated platform: set credentials, then send. No connect action
or webhook endpoint is needed. Incoming messages and recipient discovery are
external.

## Setup

The Sockethub CLI bundles this platform. For a custom server installation, install
`@sockethub/platform-whatsapp` and include it in your config's `platforms` list
alongside the other platforms you use. Node.js >= 20.19 and Redis >= 6 are required.

Create a Meta developer app with the WhatsApp use case and register a business
phone number. Use a system-user or temporary access token with
`whatsapp_business_messaging`. The actor ID is the **phone number ID** shown in
the app's WhatsApp API setup (not the phone number itself); the target ID is the
recipient's phone number in international format, for example `+15551234567`.

This implementation sends as a WhatsApp Business number through Meta's Cloud
API, not as a personal WhatsApp account. Obtain tokens outside Sockethub.

## Usage

This server-side JavaScript example uses runtime environment variables. In a
browser, obtain credentials through your application's secure runtime flow.
Choose a supported Graph API version enabled for your Meta app explicitly.

```javascript
import SockethubClient from '@sockethub/client';

const sc = await SockethubClient.connect('http://localhost:10550');
await sc.ready();
const actor = { id: process.env.WHATSAPP_PHONE_NUMBER_ID, type: 'person' };

sc.socket.emit('credentials', {
  '@context': sc.contextFor('whatsapp'),
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
    '@context': sc.contextFor('whatsapp'),
    type: 'send',
    actor,
    target: { id: '+15551234567', type: 'person' },
    object: { type: 'message', content: 'Hello from Sockethub!' }
  }, (result) => {
    if (result?.error) {
      console.error(result.error);
      return;
    }
    // A successful send returns the original activity with object.id set to
    // the WhatsApp message ID (wamid). This confirms API acceptance, not
    // delivery or reading.
    console.log(result.object?.id);
  });
});
```

## Limits and failures

- Text only, up to 4096 characters per message. Link previews are off.
- Free-form text is only accepted within 24 hours of the recipient's last
  message to your number. Sockethub does not track incoming messages or
  calculate eligibility; Meta enforces its policies. Template messages, which
  are required to start a conversation, are not supported.
- Meta error code `131047` returns the stable marker
  `meta:messaging-window-closed` followed by the original diagnostic details,
  matching the Messenger and Instagram platforms.
- Meta failures return the HTTP status, error code, and error message.
  Requests time out after 15 seconds. There are no platform-level retries:
  after a network timeout, delivery is unknown, so retrying may duplicate a send.
- No inbound messages, delivery/read receipts, templates, media, interactive
  messages, or webhook hosting.

API contract references:

- [Send messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- [Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)
