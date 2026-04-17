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
* **query** - Query room attendance and other server data

## Authentication

Credentials are sent to Sockethub via a `credentials` message before the
`connect` verb. The XMPP platform supports two equally first-class
authentication modes: **password** and **token**. Exactly one of `password` or
`token` must be provided — supplying both, or neither, will fail schema
validation.

### Credentials object

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | yes | Must be `"credentials"`. |
| `userAddress` | string | yes | Bare JID, e.g. `user@jabber.net`. |
| `resource` | string | yes | XMPP resource identifier (e.g. `"phone"`). |
| `password` | string | one of password/token | SASL password. |
| `token` | string | one of password/token | Auth token sent in the SASL PLAIN slot. |
| `server` | string | no | Overrides the hostname from `userAddress`. |
| `port` | number | no | Overrides the default port. |

### Password authentication

Use a standard XMPP account password. The server negotiates the strongest
available SASL mechanism (typically SCRAM-SHA-1, falling back to PLAIN).

```json
{
  "type": "credentials",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld"
  ],
  "actor": { "id": "user@jabber.net", "type": "person" },
  "object": {
    "type": "credentials",
    "userAddress": "user@jabber.net",
    "password": "s3cret",
    "resource": "phone"
  }
}
```

### Token authentication

Supply a pre-issued authentication token in place of the password. Sockethub
places the token in the SASL PLAIN password slot, so this mode works with any
XMPP server whose token module accepts a token where a password would normally
go. Examples include:

* **ejabberd** — `mod_auth_token` (tokens issued via `ejabberdctl
  oauth_issue_token` or the admin API).
* **Prosody** — `mod_tokenauth` (and compatible community modules).
* Any custom deployment that treats the SASL PLAIN password as a bearer token.

```json
{
  "type": "credentials",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld"
  ],
  "actor": { "id": "user@jabber.net", "type": "person" },
  "object": {
    "type": "credentials",
    "userAddress": "user@jabber.net",
    "token": "ejabberd-issued-auth-token",
    "resource": "phone"
  }
}
```

**Compatibility note**: because the token travels in the SASL PLAIN slot, the
server must advertise the PLAIN mechanism for the session. Token-auth modules
typically do this automatically. If a server advertises only SCRAM-SHA-1, the
token cannot survive SCRAM's HMAC exchange and authentication will fail — this
is a limitation of the "token-in-password-slot" approach, not of Sockethub.

A failed token authentication (expired, revoked, or unrecognised token)
surfaces the same `SASLError: not-authorized` as a bad password, and is
treated as a non-recoverable connection error.

## Usage

### Send Message Example

```json
{
  "type": "send",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld"
  ],
  "actor": {
    "id": "user@example.org",
    "type": "person"
  },
  "target": {
    "id": "friend@jabber.net",
    "type": "person"
  },
  "object": {
    "type": "message",
    "content": "Hello from Sockethub!"
  }
}
```

### Join Chat Room Example

```json
{
  "type": "join",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld"
  ],
  "actor": {
    "id": "user@example.org",
    "type": "person"
  },
  "target": {
    "id": "room@conference.example.org",
    "type": "room"
  }
}
```

### Request Friend Example

```json
{
  "type": "request-friend",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld"
  ],
  "actor": {
    "id": "user@example.org",
    "type": "person"
  },
  "target": {
    "id": "friend@jabber.net",
    "type": "person"
  }
}
```

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

Detailed API documentation can be found [here](API.md)
