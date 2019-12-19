<a name="XMPP"></a>

## XMPP
XMPP

**Kind**: global class  

* [XMPP](#XMPP)
    * [new XMPP(session)](#new_XMPP_new)
    * [.schema](#XMPP+schema)
    * [.connect(job, credentials, done)](#XMPP+connect)
    * [.join(job, credentials, done)](#XMPP+join)
    * [.send(job, credentials, done)](#XMPP+send)
    * [.update(job, credentials, done)](#XMPP+update)
    * [.request-friend(job, credentials, done)](#XMPP+request-friend)
    * [.remove-friend(job, credentials, done)](#XMPP+remove-friend)
    * [.make-friend(job, credentials, done)](#XMPP+make-friend)
    * [.observe(job, credentials, done)](#XMPP+observe)

<a name="new_XMPP_new"></a>

### new XMPP(session)
Handles all actions related to communication via. the XMPP protocol.

Uses the `simple-xmpp` node module as a base tool for interacting with XMPP.

[https://github.com/simple-xmpp/node-simple-xmpp](https://github.com/simple-xmpp/node-simple-xmpp)


| Param | Type | Description |
| --- | --- | --- |
| session | <code>object</code> | [Sockethub.Session#object](Sockethub.Session#object) |

<a name="XMPP+schema"></a>

### xmpP.schema
JSON schema defining the @types this platform accepts.

Actual handling of incoming 'set' commands are handled by dispatcher,
but the dispatcher uses this defined schema to validate credentials
received, so that when a @context @type is called, it can fetch the
credentials (`session.getConfig()`), knowing they will have already been
validated against this schema.


In the below example, sockethub will validate the incoming credentials object
against whatever is defined in the `credentials` portion of the schema
object.


It will also check if the incoming AS object uses a @type which exists in the
`@types` portion of the schema object (should be an array of @type names).

**NOTE**: For more information on using the credentials object from a client,
see [Sockethub Client](https://github.com/sockethub/sockethub/wiki/Sockethub-Client)

Valid AS object for setting XMPP credentials:

**Kind**: instance property of [<code>XMPP</code>](#XMPP)  
**Example**  
```js
{
  '@type': 'set',
  context: 'xmpp',
  actor: {
    '@id': 'testuser@jabber.net',
    '@type': 'person',
    displayName: 'Mr. Test User'
  },
  object: {
    '@type': 'credentials',
    server: 'jabber.net',
    username: 'testuser',
    password: 'asdasdasdasd',
    port: 5223,
    resource: 'phone'
  }
}
```
<a name="XMPP+connect"></a>

### xmpP.connect(job, credentials, done)
Function: connect

Connect to the XMPP server.

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activiy streams object // TODO LINK |
| credentials | <code>object</code> | credentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
{
  context: 'xmpp',
  '@type': 'connect',
  actor: {
    '@id': 'slvrbckt@jabber.net/Home',
    '@type': 'person',
    displayName: 'Nick Jennings',
    userName: 'slvrbckt'
  }
}
```
<a name="XMPP+join"></a>

### xmpP.join(job, credentials, done)
Function: join

Join a room, optionally defining a display name for that room.

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activity streams object // TODO LINK |
| credentials | <code>object</code> | credentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
{
  context: 'xmpp',
  '@type': 'join',
  actor: {
    '@type': 'person'
    '@id': 'slvrbckt@jabber.net/Home',
  },
  object: {
    '@type': 'person',
    '@id': 'slvrbckt@jabber.net/Home',
    displayName: 'Mr. Pimp'
  },
  target: {
    '@type': 'room'
    '@id': 'PartyChatRoom@muc.jabber.net',
  }
}
```
<a name="XMPP+send"></a>

### xmpP.send(job, credentials, done)
Function: send

Send a message to a room or private conversation.

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activity streams object // TODO LINK |
| credentials | <code>object</code> | credentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
{
  context: 'xmpp',
  '@type': 'send',
  actor: {
    '@id': 'slvrbckt@jabber.net/Home',
    '@type': 'person',
    displayName: 'Nick Jennings',
    userName: 'slvrbckt'
  },
  target: {
    '@id': 'homer@jabber.net/Home',
    '@type': 'user',
    displayName: 'Homer'
  },
  object: {
    '@type': 'message',
    content: 'Hello from Sockethub!'
  }
}

{
  context: 'xmpp',
  '@type': 'send',
  actor: {
    '@id': 'slvrbckt@jabber.net/Home',
    '@type': 'person',
    displayName: 'Nick Jennings',
    userName: 'slvrbckt'
  },
  target: {
    '@id': 'party-room@jabber.net',
    '@type': 'room'
  },
  object: {
    '@type': 'message',
    content: 'Hello from Sockethub!'
  }
}
```
<a name="XMPP+update"></a>

### xmpP.update(job, credentials, done)
Indicate presence and status message.

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activity streams object // TODO LINK |
| credentials | <code>object</code> | credentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
{
  context: 'xmpp',
  '@type': 'update',
  actor: {
    '@id': 'user@host.org/Home'
  },
  object: {
    '@type': 'presence'
    presence: 'chat',
    content: '...clever saying goes here...'
  }
}
```
<a name="XMPP+request-friend"></a>

### xmpP.request-friend(job, credentials, done)
Send friend request

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activity streams object // TODO LINK |
| credentials | <code>object</code> | credentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
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
<a name="XMPP+remove-friend"></a>

### xmpP.remove-friend(job, credentials, done)
Send a remove friend request

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activity streams object // TODO LINK |
| credentials | <code>object</code> | credentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
{
  context: 'xmpp',
  '@type': 'remove-friend',
  actor: {
    '@id': 'user@host.org/Home'
  },
  target: {
    '@id': 'homer@jabber.net/Home',
  }
}
```
<a name="XMPP+make-friend"></a>

### xmpP.make-friend(job, credentials, done)
Confirm a friend request

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activity streams object // TODO LINK |
| credentials | <code>object</code> | credentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
{
  context: 'xmpp',
  '@type': 'make-friend',
  actor: {
    '@id': 'user@host.org/Home'
  },
  target: {
    '@id': 'homer@jabber.net/Home',
  }
}
```
<a name="XMPP+observe"></a>

### xmpP.observe(job, credentials, done)
Function: observe

Indicate an intent to observe something (ie. get a list of users in a room).

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activity streams object // TODO LINK |
| credentials | <code>object</code> | credentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
{
   context: 'xmpp',
   '@type': 'observe',
   actor: {
     '@id': 'slvrbckt@jabber.net/Home',
     '@type': 'person'
   },
   target: {
     '@id': 'PartyChatRoom@muc.jabber.net',
     '@type': 'room'
   },
   object: {
     '@type': 'attendance'
   }
 }


 // The above object might return:
 {
   context: 'xmpp',
   '@type': 'observe',
   actor: {
     '@id': 'PartyChatRoom@muc.jabber.net',
     '@type': 'room'
   },
   target: {
     '@id': 'slvrbckt@jabber.net/Home',
     '@type': 'person'
   },
   object: {
     '@type': 'attendance'
     members: [
       'RyanGosling',
       'PeeWeeHerman',
       'Commando',
       'Smoochie',
       'neo'
     ]
   }
 }
```
