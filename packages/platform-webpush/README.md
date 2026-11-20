# `@sockethub/platform-webpush`

Web Push notifications for web apps that have no backend of their own. On iOS
a web app cannot schedule a notification on the device: the only way to notify
a user whose app is closed is for a server to send a Web Push message at the
right time. This platform is that server.

* `send` delivers one message now.
* `schedule` hands over a list of messages to deliver later. Sockethub sends
  each one when it is due, with no client connected and across restarts.

The app encrypts every message itself, for its own subscription. Sockethub
signs the request and passes the ciphertext on. It never sees the content or
the subscription's keys, and needs no user accounts.

## How it works

1. The app reads this server's public key from the
   [service descriptor](../../docs/configuration.md#api-discovery) and
   subscribes with it in the browser. The browser returns a subscription: a
   delivery URL on the browser vendor's push service, and two encryption keys.
2. The app encrypts each notification with those keys
   ([RFC 8291](https://www.rfc-editor.org/rfc/rfc8291), `aes128gcm`) and
   gives Sockethub the delivery URL and the ciphertext.
3. Sockethub signs a short-lived token with its private key
   ([RFC 8292](https://www.rfc-editor.org/rfc/rfc8292)) and posts the
   ciphertext to the delivery URL
   ([RFC 8030](https://www.rfc-editor.org/rfc/rfc8030)).
4. The push service (Apple, Google, Mozilla or Microsoft) delivers it to the
   device, where the app's service worker decrypts and shows it.

A subscription only accepts requests signed by the key it was created with.
The app should store the public key it subscribed with, and subscribe again
when the descriptor shows a different one.

## Setup

The Sockethub CLI bundles this platform but does not load it by default,
because it cannot work without a key pair. Add it to `platforms` and
configure the keys:

```json
{
  "platforms": ["@sockethub/platform-webpush"],
  "packageConfig": {
    "@sockethub/platform-webpush": {
      "vapid": {
        "publicKey": "BAEu0HrAjf-sQk7EJ26u43u24OSDIRaCl85TVXLhhn7RJY4U19x-E4H...",
        "privateKey": "08Q3FObTS5f0elafsgHE-b1vAETPn7x9uOoW1LhfxJc",
        "subject": "mailto:ops@example.org"
      }
    }
  },
  "scheduledDelivery": {
    "secret": "a random string of at least 32 characters"
  }
}
```

Generate a key pair once:

```bash
node -e '
const { privateKey } = require("node:crypto")
  .generateKeyPairSync("ec", { namedCurve: "P-256" });
const { x, y, d } = privateKey.export({ format: "jwk" });
const bytes = (value) => Buffer.from(value, "base64url");
console.log(JSON.stringify({
  publicKey: Buffer.concat([Buffer.from([4]), bytes(x), bytes(y)])
    .toString("base64url"),
  privateKey: d,
}, null, 2));'
```

`subject` is a contact address the push services can reach the operator at,
as a `mailto:` or `https:` URL. Apple refuses requests without a valid one.

`scheduledDelivery.secret` turns on `schedule`. Leave it out to offer `send`
only. See [Operating scheduled delivery](#operating-scheduled-delivery)
before turning it on.

## Usage

Every message names the app as `actor` and the subscription's delivery URL as
`target`. `content` is the complete encrypted message body, base64 or
base64url encoded, at most 4096 bytes before encoding.

Do not put anything that identifies the user in `actor.id`. Use the app's
URL. Sockethub also carries chat traffic, and a user address here would tie a
device to it.

### Send now

```json
{
  "type": "send",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/webpush/v1.jsonld"
  ],
  "actor": { "id": "https://app.example", "type": "website" },
  "target": {
    "id": "https://web.push.apple.com/QGp7rT...",
    "type": "service"
  },
  "object": {
    "type": "push",
    "content": "1qZ6mN3...",
    "ttl": 3600,
    "urgency": "normal",
    "topic": "daily-reminder"
  }
}
```

* `ttl` (default 86400, at most 2419200): seconds the push service keeps the
  message for a device that is offline.
* `urgency`: `very-low`, `low`, `normal` or `high`.
* `topic` (up to 32 URL-safe characters): a newer message with the same topic
  replaces an older one the push service has not delivered yet.

The result replaces `object` with what the push service answered. The
delivery URL and the content are not echoed back.

```json
{
  "type": "send",
  "actor": { "id": "https://app.example", "type": "website" },
  "object": { "type": "delivery", "status": "accepted", "httpStatus": 201 }
}
```

| `status` | Push service answered | Meaning |
|---|---|---|
| `accepted` | 2xx | Taken for delivery. Not proof that it was shown |
| `gone` | 404, 410 | The subscription no longer exists. Subscribe again |
| `retry` | 429, 5xx, or no answer | Temporary. `retryAfter` holds the seconds asked for, if any |
| `rejected` | Any other answer | This request can never succeed |

These are results, not errors. A URL on a host that is not an allowed push
service is `rejected` without a request being made. A server with no usable
key pair answers `retry` with `detail` set to `server-misconfigured`.

`detail` is a short code when there is one: the push service's own reason,
such as Apple's `BadJwtToken`, or a network code such as `ECONNREFUSED`. No
other text from the push service is passed on.

### Send later

```json
{
  "type": "schedule",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/webpush/v1.jsonld"
  ],
  "actor": { "id": "https://app.example", "type": "website" },
  "target": {
    "id": "https://web.push.apple.com/QGp7rT...",
    "type": "service"
  },
  "object": {
    "type": "schedule",
    "items": [
      { "deliverAt": "2026-12-01T08:00:00Z", "content": "1qZ6mN3...", "ttl": 21600 },
      { "deliverAt": "2026-12-02T08:00:00Z", "content": "9fK2pL8...", "ttl": 21600 }
    ]
  }
}
```

`items` is the complete list of future messages for that subscription. It
replaces any list sent earlier, and an empty list cancels. An item whose time
has already passed is left out, so an app can send the same list every time
it opens without repeating what was delivered. To send something now, use
`send`. Each item takes the same `ttl`, `urgency` and `topic` as `send`.

The result is `{ "type": "schedule", "pending": 2 }`, counting the items kept. It is a single HTTP
request through [HTTP actions](../../docs/configuration.md#http-actions), so
an app does not need to hold a socket open to sync.

When a message comes due:

* It is skipped if it is more than its `ttl` late, for example after a long
  outage. The server checks every five seconds, so a `ttl` of a few seconds
  is often missed. A `ttl` of 0 is given a minute.
* Otherwise it is sent, with the push service given whatever is left of the
  `ttl`.
* A `retry` answer is tried again with a growing delay, and no sooner than
  the push service asks, until the `ttl` runs out.
* A `gone` answer removes that subscription's whole list.
* A `rejected` message is dropped. The rest of the list stays.

Delivery is at least once. A server that stops between sending a message and
recording it sends it again after two minutes. Give the notification a `tag`
in your service worker so a repeat replaces the first one on screen. `topic`
only helps while the first copy is still waiting at the push service.

Knowing the delivery URL is the only authorization. It is long and
unguessable, and it is what the push service itself relies on. Anyone who has
it can replace or cancel that subscription's schedule, so treat it as a
secret.

Reminders stop when the list runs out. An app that is never opened never
sends a new list, so schedule far enough ahead to cover the gaps you expect.

## Configuration

```json
{
  "packageConfig": {
    "@sockethub/platform-webpush": {
      "vapid": { "publicKey": "...", "privateKey": "...", "subject": "mailto:ops@example.org" },
      "allowedHosts": ["*.push.apple.com", "fcm.googleapis.com"],
      "timeoutMs": 15000
    }
  },
  "scheduledDelivery": {
    "secret": "...",
    "maxMessagesPerSubscription": 60,
    "maxSubscriptions": 10000,
    "maxDaysAhead": 60,
    "maxSchedulesPerMinute": 30
  }
}
```

Under `packageConfig`:

* `vapid`: the key pair and contact described under [Setup](#setup).
* `allowedHosts`: push service hosts that may be sent to. `*.example.com`
  matches subdomains. The default is `*.push.apple.com`,
  `fcm.googleapis.com`, `updates.push.services.mozilla.com` and
  `*.notify.windows.com`. Without a list, the server would post a signed
  request to any URL a client names.
* `timeoutMs` (default 15000): time allowed for a push service to answer.
* `concurrency` (default 10): requests sent at once.
* `allowPrivateAddresses` and `allowInsecureHttp` (default `false`): for
  testing against a local stand-in push service.

Under `scheduledDelivery`:

* `secret`: encrypts stored schedules. At least 32 characters. Also settable
  as `SOCKETHUB_SCHEDULED_DELIVERY_SECRET`. Empty turns `schedule` off.
* `maxMessagesPerSubscription` (default 60): messages one subscription may
  have pending.
* `maxSubscriptions` (default 10000): subscriptions that may have a schedule
  at once. New ones are refused beyond it. Existing ones can still change or
  cancel theirs.
* `maxDaysAhead` (default 60): how far in the future `deliverAt` may be.
* `maxSchedulesPerMinute` (default 30): `schedule` requests accepted per
  client address each minute. 0 turns the limit off.

A delivery URL cannot be checked until something is sent to it, so made-up
ones can be stored. The two caps bound what that can cost: a typical
notification is under 400 bytes, and the largest allowed is about 5.5 KB in
Redis, so the defaults allow 3.3 GB in the worst case and about 240 MB in
ordinary use. Lower them on a small server.

## Operating scheduled delivery

Everything else Sockethub keeps in Redis belongs to one server run and is
unreadable after a restart. Scheduled messages have to outlive the server, so
they are stored differently, and turning this on changes what an operator has
to look after.

* **Redis needs persistence.** Turn on AOF. A Redis that loses its data loses
  every pending reminder, and nothing tells the user. Each app repairs its
  own schedule the next time it opens, but the users who most need a reminder
  are the ones who have not opened it.
* **Two secrets must survive restarts**, and be the same on every server
  sharing the Redis: the key pair and `scheduledDelivery.secret`. Back both
  up.
  * Losing or changing the secret makes stored schedules unreadable. They
    stay in Redis until they expire, and are sent again if the old secret is
    restored in time. Each app's next sync writes a new schedule.
  * Losing or changing the key pair invalidates every subscription. Each app
    must subscribe again.
* **What is stored.** One encrypted record per subscription under
  `sockethub:{scheduled}:`, holding the delivery URL, the times and the
  ciphertext. A copy of Redis without the secret reveals none of it. With the
  secret it reveals delivery URLs and times, never content.
* **Several servers can share one Redis.** Each due subscription is claimed
  by one of them, and another takes over if that one stops.
* **Logs** name push service hosts, never a delivery URL. With Sentry
  enabled, this platform's outbound requests are left out of its breadcrumbs
  and traces for the same reason.

## What it does not do

* **Encrypt for you.** That would mean holding subscription keys and
  plaintext for days.
* **Notify on incoming chat or mail.** Nothing here watches an account while
  the app is closed. Anything that does can deliver through `send`.
* **Confirm display.** Push services report that they accepted a message,
  not that the device showed it.
* **App-side work.** The permission prompt, the service worker, and
  installing to the Home Screen on iOS belong to the app.
