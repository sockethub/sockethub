# sockethub-platform-xmpp
A sockethub platform module implementing XMPP functionality.

## Overview
Each sockethub platform uses JSON Activity Streams 2.0 which are recevied from and sent to clients, through the Sockethub service.

## Implemented Verbs (`@type`)
<kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> 
<kbd>![completed](http://sockethub.org/res/img/checkmark.png) request-friend</kbd> 
<kbd>![completed](http://sockethub.org/res/img/checkmark.png) remove-friend</kbd> 
<kbd>![completed](http://sockethub.org/res/img/checkmark.png) make-friend</kbd> 
<kbd>![completed](http://sockethub.org/res/img/checkmark.png) update</kbd> 
<kbd>![completed](http://sockethub.org/res/img/checkmark.png)  join</kbd> 
<kbd>![completed](http://sockethub.org/res/img/checkmark.png) observe</kbd>

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
