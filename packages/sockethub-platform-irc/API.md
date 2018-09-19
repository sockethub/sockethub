<a name="IRC"></a>

## IRC
IRC

**Kind**: global class  

* [IRC](#IRC)
    * [new IRC(cfg)](#new_IRC_new)
    * [.schema](#IRC+schema)
    * [.join(job, credentials, done)](#IRC+join)
    * [.leave(job, credentials, done)](#IRC+leave)
    * [.send(job, credentials, done)](#IRC+send)
    * [.update(job, credentials, done)](#IRC+update)
    * [.observe(job, credentials, done)](#IRC+observe)

<a name="new_IRC_new"></a>

### new IRC(cfg)
Handles all actions related to communication via. the IRC protocol.

Uses the `irc-factory` node module as a base tool for interacting with IRC.

[https://github.com/ircanywhere/irc-factory](https://github.com/ircanywhere/irc-factory)


| Param | Type | Description |
| --- | --- | --- |
| cfg | <code>object</code> | a unique config object for this instance // TODO LINK |

<a name="IRC+schema"></a>

### irC.schema
JSON schema defining the @types this platform accepts.


In the below example, sockethub will validate the incoming credentials object
against whatever is defined in the `credentials` portion of the schema
object.


It will also check if the incoming AS object uses a @type which exists in the
`@types` portion of the schema object (should be an array of @type names).

* **NOTE**: For more information on using the credentials object from a client, see [Sockethub Client](https://github.com/sockethub/sockethub/wiki/Sockethub-Client)

Valid AS object for setting IRC credentials:

**Kind**: instance property of [<code>IRC</code>](#IRC)  
**Example**  
```js
{
   '@type': 'set',
   context: 'irc',
   actor: {
     '@id': 'irc://testuser@irc.host.net',
     '@type': 'person',
     displayName: 'Mr. Test User',
     userName: 'testuser'
   },
   object: {
     '@type': 'credentials',
     server: 'irc.host.net',
     nick: 'testuser',
     password: 'asdasdasdasd',
     port: 6697,
     secure: true
   }
 }
```
<a name="IRC+join"></a>

### irC.join(job, credentials, done)
Function: join

Join a room or private conversation.

**Kind**: instance method of [<code>IRC</code>](#IRC)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activiy streams object // TODO LINK |
| credentials | <code>object</code> | credentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
{
  context: 'irc',
  '@type': 'join',
  actor: {
    '@id': 'irc://slvrbckt@irc.freenode.net',
    '@type': 'person',
    displayName: 'slvrbckt'
  },
  target: {
    '@id': 'irc://irc.freenode.net/sockethub',
    '@type': 'room',
    displayName: '#sockethub'
  },
  object: {}
}
```
<a name="IRC+leave"></a>

### irC.leave(job, credentials, done)
Function leave

Leave a room or private conversation.

**Kind**: instance method of [<code>IRC</code>](#IRC)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activiy streams object // TODO LINK |
| credentials | <code>object</code> | credentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
{
  context: 'irc',
  '@type': 'leave',
  actor: {
    '@id': 'irc://slvrbckt@irc.freenode.net',
    '@type': 'person',
    displayName: 'slvrbckt'
  },
  target: {
    '@id': 'irc://irc.freenode.net/remotestorage',
    '@type': 'room',
    displayName: '#remotestorage'
  },
  object: {}
}
```
<a name="IRC+send"></a>

### irC.send(job, credentials, done)
Function: send

Send a message to a room or private conversation.

**Kind**: instance method of [<code>IRC</code>](#IRC)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activiy streams object // TODO LINK |
| credentials | <code>object</code> | credentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
{
   context: 'irc',
   '@type': 'send',
   actor: {
     '@id': 'irc://slvrbckt@irc.freenode.net',
     '@type': 'person',
     displayName: 'Nick Jennings',
     userName: 'slvrbckt'
   },
   target: {
     '@id': 'irc://irc.freenode.net/remotestorage',
     '@type': 'room',
     displayName: '#remotestorage'
   },
   object: {
     '@type': 'message',
     content: 'Hello from Sockethub!'
   }
 }
```
<a name="IRC+update"></a>

### irC.update(job, credentials, done)
Function: update

Indicate a change (ie. room topic update, or nickname change).

**Kind**: instance method of [<code>IRC</code>](#IRC)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activiy streams object // TODO LINK |
| credentials | <code>object</code> | redentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
change topic

{
  context: 'irc',
  '@type': 'update',
  actor: {
    '@id': 'irc://slvrbckt@irc.freenode.net',
    '@type': 'person',
    displayName: 'Nick Jennings',
    userName: 'slvrbckt'
  },
  target: {
    '@id': 'irc://irc.freenode.net/sockethub',
    '@type': 'room',
    displayName: '#sockethub'
  },
  object: {
    '@type': 'topic',
    topic: 'New version of Socekthub released!'
  }
}
```
**Example**  
```js
change nickname
 {
   context: 'irc'
   '@type': 'udpate',
   actor: {
     '@id': 'irc://slvrbckt@irc.freenode.net',
     '@type': 'person',
     displayName: 'slvrbckt'
   },
   object: {
     '@type': "address",
   },
   target: {
     '@id': 'irc://cooldude@irc.freenode.net',
     '@type': 'person',
     displayName: cooldude
   }
 }
```
<a name="IRC+observe"></a>

### irC.observe(job, credentials, done)
Function: observe

Indicate an intent to observe something (ie. get a list of users in a room).

**Kind**: instance method of [<code>IRC</code>](#IRC)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | activiy streams object // TODO LINK |
| credentials | <code>object</code> | credentials object // TODO LINK |
| done | <code>object</code> | callback when job is done // TODO LINK |

**Example**  
```js
{
   context: 'irc',
   '@type': 'observe',
   actor: {
     '@id': 'irc://slvrbckt@irc.freenode.net',
     '@type': 'person',
     displayName: 'Nick Jennings',
     userName: 'slvrbckt'
   },
   target: {
     '@id': 'irc://irc.freenode.net/sockethub',
     '@type': 'room',
     displayName: '#sockethub'
   },
   object: {
     '@type': 'attendance'
   }
 }


 // The obove object might return:
 {
   context: 'irc',
   '@type': 'observe',
   actor: {
     '@id': 'irc://irc.freenode.net/sockethub',
     '@type': 'room',
     displayName: '#sockethub'
   },
   target: {},
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
