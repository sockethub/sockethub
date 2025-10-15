# @sockethub/platform-xmpp

A Sockethub platform module implementing XMPP (Jabber) functionality for instant messaging and presence.

## About

This platform provides XMPP client functionality, allowing web applications to connect to
XMPP servers, send messages, manage contacts, join chat rooms, and handle presence
updates through ActivityStreams messages.

## Implemented Verbs (`@type`)

* **send** - Send messages to contacts or chat rooms
* **join** - Join XMPP chat rooms (MUCs)
* **observe** - Subscribe to presence updates
* **request-friend** - Send contact/buddy requests
* **remove-friend** - Remove contacts from roster
* **make-friend** - Accept contact requests
* **update** - Update presence status and information

## Usage

### Send Message Example

```json
{
  "@type": "send",
  "context": "xmpp",
  "actor": {
    "@id": "user@example.org"
  },
  "target": {
    "@id": "friend@jabber.net"
  },
  "object": {
    "@type": "Note",
    "content": "Hello from Sockethub!"
  }
}
```

### Join Chat Room Example

```json
{
  "@type": "join",
  "context": "xmpp",
  "actor": {
    "@id": "user@example.org"
  },
  "target": {
    "@id": "room@conference.example.org"
  }
}
```

### Request Friend Example

```json
{
  "@type": "request-friend",
  "context": "xmpp",
  "actor": {
    "@id": "user@example.org"
  },
  "target": {
    "@id": "friend@jabber.net"
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
