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
`connect` verb. The XMPP platform accepts a single `password` field.

### Credentials object

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | yes | Must be `"credentials"`. |
| `userAddress` | string | yes | Bare JID, e.g. `user@jabber.net`. |
| `resource` | string | yes | XMPP resource identifier (e.g. `"phone"`). |
| `password` | string | yes | SASL password. Use this field for PLAIN-slot tokens too. |
| `server` | string | no | Overrides the hostname from `userAddress`. |
| `port` | number | no | Overrides the default port. |

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
