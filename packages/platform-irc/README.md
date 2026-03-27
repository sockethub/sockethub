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
