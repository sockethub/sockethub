# @sockethub/platform-irc

A Sockethub platform module implementing IRC (Internet Relay Chat) functionality.

## About

This platform provides IRC client functionality, allowing web applications to connect to
IRC servers, join channels, send messages, and handle IRC events through ActivityStreams
messages.

## Implemented Verbs (`type`)

* **send** - Send messages to channels or users
* **join** - Join IRC channels
* **leave** - Leave IRC channels
* **observe** - Monitor channel activity and user events
* **update** - Update user information (nick, etc.)

## Usage

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
    "type": "room"
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
    "type": "room"
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

## Authentication

Authenticated connections use SASL. Two mechanisms are supported:

* **`PLAIN`** — sends a username and password. This is the default when
  `password` is set, and is supported by most IRC networks (Libera.Chat,
  OFTC, etc.).
* **`OAUTHBEARER`** — sends an OAuth 2.0 access token instead of a password
  ([RFC 7628](https://datatracker.ietf.org/doc/html/rfc7628)). Adoption on
  public IRC networks is still limited; the main deployment is SourceHut's
  `chat.sr.ht` (via the [soju](https://soju.im/) bouncer). Major networks
  such as Libera.Chat, OFTC, and Hackint do not currently advertise
  OAUTHBEARER. See emersion's [IRC × OAuth 2.0](https://emersion.fr/blog/2022/irc-and-oauth2/)
  writeup for background. How to obtain the token is provider-specific and
  outside the scope of this module.

`password` and `token` are mutually exclusive. `saslMechanism` is inferred
from whichever is present, or may be set explicitly.

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

Detailed API documentation can be found [here](API.md)
