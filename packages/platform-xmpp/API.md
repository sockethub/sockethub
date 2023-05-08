# Members

<dl>
<dt><a href="#schema">schema</a></dt>
<dd><p>JSON schema defining the types this platform accepts.</p>
<p>Actual handling of incoming &#39;set&#39; commands are handled by dispatcher,
but the dispatcher uses this defined schema to validate credentials
received, so that when a @context type is called, it can fetch the
credentials (<code>session.getConfig()</code>), knowing they will have already been
validated against this schema.</p>
<p>In the below example, Sockethub will validate the incoming credentials object
against whatever is defined in the <code>credentials</code> portion of the schema
object.</p>
<p>It will also check if the incoming AS object uses a type which exists in the
<code>types</code> portion of the schema object (should be an array of type names).</p>
<p><strong>NOTE</strong>: For more information on using the credentials object from a client,
see <a href="https://github.com/sockethub/sockethub/wiki/Sockethub-Client">Sockethub Client</a></p>
<p>Valid AS object for setting XMPP credentials:</p>
</dd>
</dl>

# Functions

<dl>
<dt><a href="#connect">connect(job, credentials, done)</a></dt>
<dd><p>Connect to the XMPP server.</p>
</dd>
<dt><a href="#join">join(job, done)</a></dt>
<dd><p>Join a room, optionally defining a display name for that room.</p>
</dd>
<dt><a href="#leave">leave(job, done)</a></dt>
<dd><p>Leave a room</p>
</dd>
<dt><a href="#send">send(job, done)</a></dt>
<dd><p>Send a message to a room or private conversation.</p>
</dd>
<dt><a href="#update">update(job, done)</a></dt>
<dd><p>Indicate presence and status message.
Valid presence values are &quot;away&quot;, &quot;chat&quot;, &quot;dnd&quot;, &quot;xa&quot;, &quot;offline&quot;, &quot;online&quot;.</p>
</dd>
<dt><a href="#request-friend">request-friend(job, done)</a></dt>
<dd><p>Send friend request</p>
</dd>
<dt><a href="#remove-friend">remove-friend(job, done)</a></dt>
<dd><p>Send a remove friend request</p>
</dd>
<dt><a href="#make-friend">make-friend(job, done)</a></dt>
<dd><p>Confirm a friend request</p>
</dd>
<dt><a href="#query">query(job, done)</a></dt>
<dd><p>Indicate an intent to query something (ie. get a list of users in a room).</p>
</dd>
<dt><a href="#cleanup">cleanup(done)</a></dt>
<dd><p>Called when it&#39;s time to close any connections or clean data before being wiped
forcefully.</p>
</dd>
</dl>

<a name="schema"></a>

# schema
JSON schema defining the types this platform accepts.

Actual handling of incoming 'set' commands are handled by dispatcher,
but the dispatcher uses this defined schema to validate credentials
received, so that when a @context type is called, it can fetch the
credentials (`session.getConfig()`), knowing they will have already been
validated against this schema.


In the below example, Sockethub will validate the incoming credentials object
against whatever is defined in the `credentials` portion of the schema
object.


It will also check if the incoming AS object uses a type which exists in the
`types` portion of the schema object (should be an array of type names).

**NOTE**: For more information on using the credentials object from a client,
see [Sockethub Client](https://github.com/sockethub/sockethub/wiki/Sockethub-Client)

Valid AS object for setting XMPP credentials:

**Kind**: global variable  
**Example**  
```js
{
  type: 'credentials',
  context: 'xmpp',
  actor: {
    id: 'testuser@jabber.net',
    type: 'person',
    name: 'Mr. Test User'
  },
  object: {
    type: 'credentials',
    userAddress: 'testuser@jabber.net',
    password: 'asdasdasdasd',
    resource: 'phone'
  }
}
```
<a name="connect"></a>

# connect(job, credentials, done)
Connect to the XMPP server.

**Kind**: global function  
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
  type: 'connect',
  actor: {
    id: 'slvrbckt@jabber.net/Home',
    type: 'person',
    name: 'Nick Jennings',
    userName: 'slvrbckt'
  }
}
```
<a name="join"></a>

# join(job, done)
Join a room, optionally defining a display name for that room.

**Kind**: global function  
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
  type: 'join',
  actor: {
    type: 'person',
    id: 'slvrbckt@jabber.net/Home',
    name: 'Mr. Pimp'
  },
  target: {
    type: 'room',
    id: 'PartyChatRoom@muc.jabber.net'
  }
}
```
<a name="leave"></a>

# leave(job, done)
Leave a room

**Kind**: global function  
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
  type: 'leave',
  actor: {
    type: 'person',
    id: 'slvrbckt@jabber.net/Home',
    name: 'slvrbckt'
  },
  target: {
    type: 'room'
    id: 'PartyChatRoom@muc.jabber.net',
  }
}
```
<a name="send"></a>

# send(job, done)
Send a message to a room or private conversation.

**Kind**: global function  
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
  type: 'send',
  actor: {
    id: 'slvrbckt@jabber.net/Home',
    type: 'person',
    name: 'Nick Jennings',
    userName: 'slvrbckt'
  },
  target: {
    id: 'homer@jabber.net/Home',
    type: 'user',
    name: 'Homer'
  },
  object: {
    type: 'message',
    content: 'Hello from Sockethub!'
  }
}

{
  context: 'xmpp',
  type: 'send',
  actor: {
    id: 'slvrbckt@jabber.net/Home',
    type: 'person',
    name: 'Nick Jennings',
    userName: 'slvrbckt'
  },
  target: {
    id: 'party-room@jabber.net',
    type: 'room'
  },
  object: {
    type: 'message',
    content: 'Hello from Sockethub!'
  }
}
```
<a name="update"></a>

# update(job, done)
Indicate presence and status message.
Valid presence values are "away", "chat", "dnd", "xa", "offline", "online".

**Kind**: global function  
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
  type: 'update',
  actor: {
    id: 'user@host.org/Home'
  },
  object: {
    type: 'presence'
    presence: 'away',
    content: '...clever saying goes here...'
  }
}
```
<a name="request-friend"></a>

# request-friend(job, done)
Send friend request

**Kind**: global function  
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
  type: 'request-friend',
  actor: {
    id: 'user@host.org/Home'
  },
  target: {
    id: 'homer@jabber.net/Home',
  }
}
```
<a name="remove-friend"></a>

# remove-friend(job, done)
Send a remove friend request

**Kind**: global function  
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
  type: 'remove-friend',
  actor: {
    id: 'user@host.org/Home'
  },
  target: {
    id: 'homer@jabber.net/Home',
  }
}
```
<a name="make-friend"></a>

# make-friend(job, done)
Confirm a friend request

**Kind**: global function  
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
  type: 'make-friend',
  actor: {
    id: 'user@host.org/Home'
  },
  target: {
    id: 'homer@jabber.net/Home',
  }
}
```
<a name="query"></a>

# query(job, done)
Indicate an intent to query something (ie. get a list of users in a room).

**Kind**: global function  
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
   type: 'query',
   actor: {
     id: 'slvrbckt@jabber.net/Home',
     type: 'person'
   },
   target: {
     id: 'PartyChatRoom@muc.jabber.net',
     type: 'room'
   },
   object: {
     type: 'attendance'
   }
 }

 // The above object might return:
 {
   context: 'xmpp',
   type: 'query',
   actor: {
     id: 'PartyChatRoom@muc.jabber.net',
     type: 'room'
   },
   target: {
     id: 'slvrbckt@jabber.net/Home',
     type: 'person'
   },
   object: {
     type: 'attendance'
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
<a name="cleanup"></a>

# cleanup(done)
Called when it's time to close any connections or clean data before being wiped
forcefully.

**Kind**: global function  
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

