# @sockethub/platform-xmpp

A Sockethub platform module implementing XMPP (Jabber) functionality for instant messaging and presence.

## About

This platform provides XMPP client functionality, allowing web applications to connect to
XMPP servers, send messages, manage contacts, join chat rooms, and handle presence
updates through ActivityStreams messages.

## Implemented Verbs (`type`)

* **connect** - Establish a connection to the XMPP server
* **disconnect** - Close the XMPP connection
* **join** - Join an XMPP chat room (MUC)
* **leave** - Leave an XMPP chat room
* **send** - Send messages to contacts or chat rooms
* **update** - Update presence status and information
* **request-friend** - Send a contact/buddy request
* **remove-friend** - Remove a contact from the roster
* **make-friend** - Accept a contact request
* **query** - Query room attendance and room information via service discovery

## Authentication

Credentials are sent to Sockethub via a `credentials` message before the
`connect` verb. The XMPP platform accepts a single `password` field.

Authentication requires an encrypted connection: direct TLS (`xmpps://`) or
a successful STARTTLS upgrade. If the server does not offer encryption, the
connection fails before credentials are sent.
This requirement also applies to automatic reconnections.

### Credentials object

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | string | yes | Must be `"credentials"`. |
| `userAddress` | string | yes | Bare JID, e.g. `user@jabber.net`. |
| `resource` | string | yes | XMPP resource identifier (e.g. `"phone"`). |
| `password` | string | yes | SASL password. Use this field for PLAIN-slot tokens too. |
| `server` | string | no | Overrides the host from `userAddress`. Host name or `xmpp(s)://` URI. |
| `port` | integer | no | Overrides the default port (1-65535). |

Without a `port`, a bare host is looked up through its `_xmpps-client` and
`_xmpp-client` SRV records, and its own addresses on ports 5223 (direct TLS)
and 5222. A bare host with a `port` skips SRV lookup and connects with
`xmpp://` (STARTTLS) on that port. For direct TLS, set `server` to an
`xmpps://` URI. The platform does not use HTTP host-meta discovery or the
WebSocket transport.

An internationalized host name (such as `bücher.example`) works only as a bare
host without a `port`. With a `port`, or inside an `xmpp(s)://` URI, it is
refused; use its ASCII form (`xn--bcher-kva.example`) instead.

### Private addresses

The platform refuses to connect to loopback, private, link-local, and cloud
metadata addresses, using the same address rules as the
[outbound URL guard](../../docs/configuration.md#outbound-url-guard). To reach
an XMPP server on a private network, set `allowPrivateAddresses` in this
platform's `packageConfig` entry:

```json
{
  "packageConfig": {
    "@sockethub/platform-xmpp": {
      "allowPrivateAddresses": true
    }
  }
}
```

Do not enable it on a server that accepts untrusted clients. Any client could
then make Sockethub connect to internal services.

### Password authentication

Use a standard XMPP account password. The server negotiates the strongest
available SASL mechanism (typically SCRAM-SHA-1, falling back to PLAIN).
The examples below assume you already have an initialized Sockethub client
instance named `sc`.

```javascript
{
  type: "credentials",
  "@context": sc.contextFor("xmpp"),
  actor: { id: "user@jabber.net", type: "person" },
  object: {
    type: "credentials",
    userAddress: "user@jabber.net",
    password: "s3cret",
    resource: "phone"
  }
}
```

If your deployment expects a bearer-style token in the SASL PLAIN password
slot, pass that token string as `password`. This is only a narrow
compatibility mode. Dedicated token SASL mechanisms such as ejabberd
`X-OAUTH2`, Prosody `OAUTHBEARER`, Prosody community `X-TOKEN`, and SASL2 FAST
are not implemented by the bundled `@xmpp/client`, which only supports
`SCRAM-SHA-1`, `PLAIN`, and `ANONYMOUS` and prefers `SCRAM-SHA-1` when both
SCRAM and PLAIN are offered.

A failed authentication with either a traditional password or a token string
surfaces the same `SASLError: not-authorized` and is treated as a
non-recoverable connection error.

## Usage

### Connect Example

```javascript
{
  type: "connect",
  "@context": sc.contextFor("xmpp"),
  actor: {
    id: "user@example.org/web",
    type: "person"
  }
}
```

### Send Message Example

```javascript
{
  type: "send",
  "@context": sc.contextFor("xmpp"),
  actor: {
    id: "user@example.org",
    type: "person"
  },
  target: {
    id: "friend@jabber.net",
    type: "person"
  },
  object: {
    type: "message",
    content: "Hello from Sockethub!"
  }
}
```

### Send Room Message Example

```javascript
{
  type: "send",
  "@context": sc.contextFor("xmpp"),
  actor: {
    id: "user@example.org/web",
    type: "person"
  },
  target: {
    id: "room@conference.example.org",
    type: "room"
  },
  object: {
    type: "message",
    content: "Hello room"
  }
}
```

### Update Presence Example

```javascript
{
  type: "update",
  "@context": sc.contextFor("xmpp"),
  actor: {
    id: "user@example.org/web",
    type: "person"
  },
  object: {
    type: "presence",
    presence: "away",
    content: "Out for lunch"
  }
}
```

### Query Room Attendance Response Example

```javascript
{
  type: "query",
  "@context": sc.contextFor("xmpp"),
  actor: {
    id: "room@conference.example.org",
    type: "room"
  },
  target: {
    id: "user@example.org/web",
    type: "person"
  },
  object: {
    type: "attendance",
    members: ["alice", "bob", "carol"]
  }
}
```

### Query Room Attendance Example

```javascript
{
  type: "query",
  "@context": sc.contextFor("xmpp"),
  actor: {
    id: "user@example.org/web",
    type: "person"
  },
  target: {
    id: "room@conference.example.org",
    type: "room"
  },
  object: {
    type: "attendance"
  }
}
```

### Query Room Information Example

```javascript
{
  type: "query",
  "@context": sc.contextFor("xmpp"),
  actor: {
    id: "user@example.org/web",
    type: "person"
  },
  target: {
    id: "room@conference.example.org",
    type: "room"
  },
  object: {
    type: "room-info"
  }
}
```

### Query Room Information Response Example

```javascript
{
  type: "query",
  "@context": sc.contextFor("xmpp"),
  actor: {
    id: "room@conference.example.org",
    type: "room",
    name: "Room Display Name"
  },
  target: {
    id: "user@example.org/web",
    type: "person"
  },
  object: {
    type: "room-info",
    features: ["http://jabber.org/protocol/muc", "muc_passwordprotected"],
    identities: [{
      category: "conference",
      type: "text",
      name: "Room Display Name"
    }]
  }
}
```

### Disconnect Example

```javascript
{
  type: "disconnect",
  "@context": sc.contextFor("xmpp"),
  actor: {
    id: "user@example.org/web",
    type: "person"
  }
}
```

### Join Chat Room Example

```javascript
{
  type: "join",
  "@context": sc.contextFor("xmpp"),
  actor: {
    id: "user@example.org",
    type: "person"
  },
  target: {
    id: "room@conference.example.org",
    type: "room"
  }
}
```

### Request Friend Example

```javascript
{
  type: "request-friend",
  "@context": sc.contextFor("xmpp"),
  actor: {
    id: "user@example.org",
    type: "person"
  },
  target: {
    id: "friend@jabber.net",
    type: "person"
  }
}
```

## Incoming presence and roster

Live presence arrives as an `update` with `object.type` `presence`. `actor.id`
is the sender's full JID, with `actor.type` `room` for a joined room and
`person` otherwise; when the stanza has no `to`, `actor.name` is the resource
part. `object.presence` is the `<show>` value, `offline` for an `unavailable`
stanza, and `online` otherwise. A `<status>` element is copied to
`object.content`. The responses schema accepts only `away`, `chat`, `dnd`,
`xa`, `offline`, `online`, and `notauthorized`; a stanza with any other
`<show>` value is dropped and the server logs
`dropping malformed outbound message`.

Roster data (`jabber:iq:roster`) is trusted only from the server (a stanza
with no `from`) or from this account's own bare JID, per
[RFC 6121 section 2.1.6](https://www.rfc-editor.org/rfc/rfc6121#section-2.1.6).
Any other sender, including this account's full JID, is ignored and produces
no client event. Roster items with subscription `none`, `to`, or `from`
without a pending request are delivered as `request-friend`, with the contact
JID and roster name in `actor`. Items with a mutual (`both`) subscription are
delivered as a presence `update` with `object.presence` `online`; items where
this account's own subscription request is still pending (`from` with
`ask="subscribe"`) are delivered as a presence `update` with
`object.presence` `notauthorized`. Every roster
activity carries this account's bare JID in `target.id`.

## Features

* **Instant messaging**: Send and receive one-on-one messages
* **Multi-user chat**: Join and participate in chat rooms (MUCs)
* **Contact management**: Add, remove, and manage contact lists
* **Presence**: Handle online/offline status and presence updates
* **Authentication**: Support for various XMPP authentication methods

## Use Cases

* **Web-based chat**: Build XMPP chat clients in web browsers
* **Integration platforms**: Connect web services to XMPP networks
* **Notification systems**: Send alerts through XMPP messages
* **Federated communication**: Connect to the decentralized XMPP network

## API

API reference docs are generated from the source JSDoc and are not committed to this repository.
Run `bun run doc` in this package to generate them locally.
