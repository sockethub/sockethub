# @sockethub/platform-xmpp

A Sockethub platform module implementing XMPP functionality.

## Overview

Each Sockethub platform uses JSON Activity Streams 2.0 which are received from and sent to clients,
through the Sockethub service.

More details can be found in the API docs [here](API.md)

* send
* request-friend
* remove-friend
* make-friend
* update
* join
* observe
* room-info

## Example

```
{
  context: 'xmpp',
  '@type': 'request-friend',
  actor: {
    '@id': 'user@host.org/Home'
  },
  target: {
    '@id': 'homer@jabber.net/Home',
  }
}
```

## API

API docs can be found [here](API.md)
