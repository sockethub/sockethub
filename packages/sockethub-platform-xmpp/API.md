<a name="XMPP"></a>

# XMPP
Handles all actions related to communication via. the XMPP protocol.

Uses `xmpp.js` as a base tool for interacting with XMPP.

[https://github.com/xmppjs/xmpp.js](https://github.com/xmppjs/xmpp.js)

**Kind**: global class  

* [XMPP](#XMPP)
    * [new XMPP(session)](#new_XMPP_new)
    * [.schema](#XMPP+schema)
    * [.connect(job, credentials, done)](#XMPP+connect)
    * [.join(job, done)](#XMPP+join)
    * [.send(job, done)](#XMPP+send)
    * [.update(job, done)](#XMPP+update)
    * [.request-friend(job, done)](#XMPP+request-friend)
    * [.remove-friend(job, done)](#XMPP+remove-friend)
    * [.make-friend(job, done)](#XMPP+make-friend)
    * [.observe(job, done)](#XMPP+observe)
    * [.cleanup(done)](#XMPP+cleanup)

<a name="new_XMPP_new"></a>

## new XMPP(session)
Constructor called from the sockethub Platform instance, passing in a
session object.

<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>session</td><td><code>object</code></td><td><p><a href="Sockethub.Platform.PlatformSession#object">Sockethub.Platform.PlatformSession#object</a></p>
</td>
    </tr>  </tbody>
</table>

<a name="XMPP+schema"></a>

## xmpP.schema
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

## xmpP.connect(job, credentials, done)
Connect to the XMPP server.

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object // TODO LINK</p>
</td>
    </tr><tr>
    <td>credentials</td><td><code>object</code></td><td><p>credentials object // TODO LINK</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done // TODO LINK</p>
</td>
    </tr>  </tbody>
</table>

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

## xmpP.join(job, done)
Join a room, optionally defining a display name for that room.

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object // TODO LINK</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done // TODO LINK</p>
</td>
    </tr>  </tbody>
</table>

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

## xmpP.send(job, done)
Send a message to a room or private conversation.

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object // TODO LINK</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done // TODO LINK</p>
</td>
    </tr>  </tbody>
</table>

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

## xmpP.update(job, done)
Indicate presence and status message.

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object // TODO LINK</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done // TODO LINK</p>
</td>
    </tr>  </tbody>
</table>

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

## xmpP.request-friend(job, done)
Send friend request

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object // TODO LINK</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done // TODO LINK</p>
</td>
    </tr>  </tbody>
</table>

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

## xmpP.remove-friend(job, done)
Send a remove friend request

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object // TODO LINK</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done // TODO LINK</p>
</td>
    </tr>  </tbody>
</table>

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

## xmpP.make-friend(job, done)
Confirm a friend request

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object // TODO LINK</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done // TODO LINK</p>
</td>
    </tr>  </tbody>
</table>

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

## xmpP.observe(job, done)
Indicate an intent to observe something (ie. get a list of users in a room).

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object // TODO LINK</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done // TODO LINK</p>
</td>
    </tr>  </tbody>
</table>

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
<a name="XMPP+cleanup"></a>

## xmpP.cleanup(done)
Called when it's time to close any connections or clean data before being wiped
forcefully.

**Kind**: instance method of [<code>XMPP</code>](#XMPP)  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>done</td><td><code>function</code></td><td><p>callback when complete</p>
</td>
    </tr>  </tbody>
</table>

