## Classes

<dl>
<dt><a href="#IRC">IRC</a></dt>
<dd><p>IRC</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#leave">leave()</a></dt>
<dd><p>Leave a room or private conversation.</p>
</dd>
</dl>

<a name="IRC"></a>

## IRC
IRC

**Kind**: global class  

* [IRC](#IRC)
    * [new IRC(session)](#new_IRC_new)
    * [.schema](#IRC+schema)
    * [.join(job, done)](#IRC+join)
    * [.send(job, done)](#IRC+send)
    * [.update(job, done)](#IRC+update)
    * [.observe(job, done)](#IRC+observe)

<a name="new_IRC_new"></a>

### new IRC(session)
Handles all actions related to communication via. the IRC protocol.

Uses the `irc-factory` node module as a base tool for interacting with IRC.

[https://github.com/ircanywhere/irc-factory](https://github.com/ircanywhere/irc-factory)


| Param | Type | Description |
| --- | --- | --- |
| session | <code>object</code> | [Sockethub.Session#object](Sockethub.Session#object) |

<a name="IRC+schema"></a>

### irC.schema
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

### irC.join(job, done)
Function: join

Join a room or private conversation.

**Kind**: instance method of [<code>IRC</code>](#IRC)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | Activity streams job object |
| done | <code>object</code> | callback when complete |

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
<a name="IRC+send"></a>

### irC.send(job, done)
Function: send

Send a message to a room or private conversation.

**Kind**: instance method of [<code>IRC</code>](#IRC)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | Activity streams job object |
| done | <code>object</code> | callback when complete |

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

### irC.update(job, done)
Function: update

Indicate a change (ie. room topic update, or nickname change).

**Kind**: instance method of [<code>IRC</code>](#IRC)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | Activity streams job object |
| done | <code>object</code> | callback when complete |

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
// TODO review, also when we rename a user, their person
//      object needs to change (and their credentials)

 {
   '@id': 1234,
   context: 'irc',
   '@type': 'udpate',
   actor: {
     '@id': 'irc://slvrbckt@irc.freenode.net',
     '@type': 'person',
     displayName: 'Nick Jennings',
     userName: 'slvrbckt'
   },
   object: {
     '@type': 'displayName'
   },
   target: {
     '@type': "person",
     displayName: 'CoolDude'
   }
 }
```
<a name="IRC+observe"></a>

### irC.observe(job, done)
Function: observe

Indicate an intent to observe something (ie. get a list of users in a room).

**Kind**: instance method of [<code>IRC</code>](#IRC)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>object</code> | Activity streams job object |
| done | <code>object</code> | callback when complete |

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
<a name="leave"></a>

## leave()
Leave a room or private conversation.

**Kind**: global function  

| Type | Description |
| --- | --- |
| <code>object</code> | Activity streams job object |
| <code>object</code> | callback when complete |

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
