# @sockethub/platform-irc

A Sockethub platform module implementing IRC (Internet Relay Chat) functionality.

## About

This platform provides IRC client functionality, allowing web applications to connect to
IRC servers, join channels, send messages, and handle IRC events through ActivityStreams
messages.

## Implemented Verbs (`type`)

* **connect** - Open the IRC connection after credentials are stored
* **send** - Send messages to channels or users
* **join** - Join IRC channels
* **leave** - Leave IRC channels
* **update** - Change a nick (`address`) or a channel topic (`topic`)
* **query** - List who is in a channel, or list channels on the server
* **disconnect** - Close the IRC connection

Incoming chat, joins, presence, and nick changes arrive as messages. There is
no separate observe command. `/me` is a `send` whose `object.content` starts
with `/me`.

## Usage

IRC room targets use `#channel@server` in `target.id` (for example
`#general@irc.libera.chat`). When you include `target.name`, use the channel
name as it appears on IRC (for example `#general`).

### Send Message Example

```json
{
  "type": "send",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "mynick@irc.libera.chat",
    "type": "person"
  },
  "target": {
    "id": "#general@irc.libera.chat",
    "type": "room",
    "name": "#general"
  },
  "object": {
    "type": "message",
    "content": "Hello IRC channel!"
  }
}
```

### Join Channel Example

```json
{
  "type": "join",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "mynick@irc.libera.chat",
    "type": "person"
  },
  "target": {
    "id": "#general@irc.libera.chat",
    "type": "room",
    "name": "#general"
  }
}
```

### Private Message Example

```json
{
  "type": "send",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "mynick@irc.libera.chat",
    "type": "person"
  },
  "target": {
    "id": "friend@irc.libera.chat",
    "type": "person"
  },
  "object": {
    "type": "message",
    "content": "Hello friend!"
  }
}
```

### Update Topic Example

```json
{
  "type": "update",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "mynick@irc.libera.chat",
    "type": "person"
  },
  "target": {
    "id": "#general@irc.libera.chat",
    "type": "room",
    "name": "#general"
  },
  "object": {
    "type": "topic",
    "content": "New channel topic"
  }
}
```

### Update Nickname Example

```json
{
  "type": "update",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "mynick@irc.libera.chat",
    "type": "person"
  },
  "target": {
    "id": "newnick@irc.libera.chat",
    "type": "person",
    "name": "newnick"
  },
  "object": {
    "type": "address"
  }
}
```

### Nick changes

`target.name` is the nick sent in `NICK`. `target.id` is that nick as a person
id, `newnick@server`. On success the connection is re-keyed to that actor.
Later commands must use the new `actor.id`.

The client library moves stored credentials, connect, and join entries when
the update is acknowledged without an error, and when the server reports a
rename of an actor this session holds. The credential object stays as
submitted (`nick`, `password`, `token`, and the rest). The live connection is
selected by a fingerprint of that original object, so a reconnect that also
rewrites `nick` misses it and opens another session. See the
[client guide](../../docs/client-guide.md#irc-nick-changes).

A callback or message that contains `error` means the nick did not change.
Keep the previous actor. That includes:

* Another account is already stored for the target actor, in this session or
  in another session on the same connection. `NICK` is not sent. The error is
  `cannot rename <old-actor> to <new-actor>: credentials already stored for <new-actor>`.
  The same credential object already stored at the new actor is not a
  collision.
* The IRC server rejects the nick. The callback `error` is the server's
  reason text. These numeric replies fail the command instead of leaving it
  waiting: 431 (no nickname), 432 (erroneous nickname), 433 (nickname in
  use), 436 (collision), 437 (temporarily unavailable), and 438 (nick change
  too fast; sent by solanum, ircu, and Unreal).

A server-forced rename of this connection arrives as an `update` with
`object.type` `address`, `actor` the previous identity and `target` the new
one. If Sockethub cannot re-key the worker, that message includes `error`
and the session stays on the previous actor. Other users' nick changes use
the same shape and are delivered as ordinary messages.

### Query Attendance Example

```json
{
  "type": "query",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "mynick@irc.libera.chat",
    "type": "person"
  },
  "target": {
    "id": "#general@irc.libera.chat",
    "type": "room",
    "name": "#general"
  },
  "object": {
    "type": "attendance"
  }
}
```

### Query Attendance Response Example

```json
{
  "type": "query",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "#general@irc.libera.chat",
    "type": "room",
    "name": "#general"
  },
  "target": {
    "id": "mynick@irc.libera.chat",
    "type": "person",
    "name": "mynick"
  },
  "object": {
    "type": "attendance",
    "members": ["alice", "bob", "carol"],
    "roles": { "alice": "owner", "bob": "participant" }
  }
}
```

`roles` maps a nick to `owner` (channel op, admin or founder), `admin` (half-op)
or `participant` (voiced). Nicks absent from it are plain members.

### Query Channels Example

Lists channels on the server. `object.name` is an optional `LIST` mask (one
parameter, no spaces). Rows use the server's `CHANTYPES` (`#` and `&` by
default). The server still sends every row; the response is capped at 5000
items and includes `"truncated": true` when rows were dropped.

```json
{
  "type": "query",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "mynick@irc.libera.chat",
    "type": "person"
  },
  "target": {
    "id": "irc.libera.chat",
    "type": "service"
  },
  "object": {
    "type": "channels",
    "name": "#sockethub*"
  }
}
```

### Query Channels Response Example

One message is sent once the server finishes the list.

```json
{
  "type": "query",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "irc.libera.chat",
    "type": "service",
    "name": "irc.libera.chat"
  },
  "object": {
    "type": "channels",
    "items": [
      {
        "id": "#sockethub@irc.libera.chat",
        "type": "room",
        "name": "#sockethub",
        "members": 12,
        "summary": "Sockethub development"
      }
    ]
  }
}
```

### Disconnect Example

```json
{
  "type": "disconnect",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "mynick@irc.libera.chat",
    "type": "person"
  }
}
```

## Authentication

Authenticated connections use SASL. Two mechanisms are supported:

* **`PLAIN`** — sends a username and secret via SASL PLAIN. This is the
  default mechanism, and is supported by most IRC networks (Libera.Chat,
  OFTC, etc.). Both `password` and `token` use PLAIN by default. Use
  `token` for personal access tokens (e.g. Libera.Chat NickServ tokens)
  to avoid storing primary account passwords.
* **`OAUTHBEARER`** — sends an OAuth 2.0 access token instead of a password
  ([RFC 7628](https://datatracker.ietf.org/doc/html/rfc7628)). Requires
  `saslMechanism: "OAUTHBEARER"` to be set explicitly. Adoption on
  public IRC networks is still limited; the main deployment is SourceHut's
  `chat.sr.ht` (via the [soju](https://soju.im/) bouncer). Major networks
  such as Libera.Chat, OFTC, and Hackint do not currently advertise
  OAUTHBEARER. See emersion's [IRC × OAuth 2.0](https://emersion.fr/blog/2022/irc-and-oauth2/)
  writeup for background. How to obtain the token is provider-specific and
  outside the scope of this module.

`password` and `token` are mutually exclusive. Both default to SASL PLAIN;
set `saslMechanism: "OAUTHBEARER"` explicitly for OAuth 2.0 bearer tokens.
Secure connections validate the IRC server's TLS certificate by default. The
optional `allowInvalidCert` field defaults to `false`; when set to `true`, it
disables TLS certificate validation for secure connections. Use this
security-relevant opt-out only for trusted self-signed IRC networks.

### Credentials with password (SASL PLAIN)

```json
{
  "type": "credentials",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "mynick@irc.libera.chat",
    "type": "person"
  },
  "object": {
    "type": "credentials",
    "nick": "mynick",
    "server": "irc.libera.chat",
    "password": "secret",
    "port": 6697,
    "secure": true
  }
}
```

### Credentials with personal access token (SASL PLAIN)

Networks like Libera.Chat accept NickServ personal access tokens via
SASL PLAIN. Use the `token` field instead of `password` to make the
distinction clear:

```json
{
  "type": "credentials",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "mynick@irc.libera.chat",
    "type": "person"
  },
  "object": {
    "type": "credentials",
    "nick": "mynick",
    "server": "irc.libera.chat",
    "token": "my-personal-access-token",
    "port": 6697,
    "secure": true
  }
}
```

### Credentials with OAuth token (SASL OAUTHBEARER)

```json
{
  "type": "credentials",
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld"
  ],
  "actor": {
    "id": "mynick@chat.sr.ht",
    "type": "person"
  },
  "object": {
    "type": "credentials",
    "nick": "mynick",
    "server": "chat.sr.ht",
    "token": "oauth-access-token",
    "saslMechanism": "OAUTHBEARER",
    "port": 6697,
    "secure": true
  }
}
```

## Messages and CTCP

A normal `send` is a channel or private `PRIVMSG`. The request schema only
accepts `object.type` `message`; the content decides the IRC command. Content
starting with `/me` is sent as a CTCP `ACTION` and content starting with
`/notice` is sent as a `NOTICE`, with the prefix stripped. An incoming
`ACTION` is delivered with `object.type` `me`. An incoming `NOTICE` is
delivered as a plain `message`.

Other incoming CTCP is not delivered to the application. The platform answers
`VERSION` with `Sockethub <platform version>` and `PING` by echoing the
argument. Other requests, and every CTCP reply, are ignored. Sending CTCP
other than `me` is not supported.

Channel and private `send` values, nicks, and topics must not contain CR or
LF. A value that does is rejected before anything is written to the socket.

## Features

* **Channel communication**: Join and participate in IRC channels
* **Private messaging**: Send direct messages to other users
* **User management**: Handle nick changes and user information
* **Network support**: Connect to various IRC networks
* **Event handling**: Process IRC events and convert to ActivityStreams

## Use Cases

* **Web IRC clients**: Build browser-based IRC chat applications
* **Chatbots**: Create IRC bots that integrate with web services
* **Notification systems**: Send alerts to IRC channels
* **Community integration**: Connect web platforms to IRC communities

## API

API reference docs are generated from the source JSDoc and are not committed to this repository.
Run `bun run doc` in this package to generate them locally.
