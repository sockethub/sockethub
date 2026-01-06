# Members

<dl>
<dt><a href="#schema">schema</a></dt>
<dd><p>JSON schema defining the types this platform accepts.</p>
<p>In the below example, Sockethub will validate the incoming credentials object
against whatever is defined in the <code>credentials</code> portion of the schema
object.</p>
<p>It will also check if the incoming AS object uses a type which exists in the
<code>types</code> portion of the schema object (should be an array of type names).</p>
<ul>
<li><strong>NOTE</strong>: For more information on using the credentials object from a client,
see <a href="https://github.com/sockethub/sockethub/wiki/Sockethub-Client">Sockethub Client</a></li>
</ul>
<p>Valid AS object for setting IRC credentials:</p>
</dd>
</dl>

# Functions

<dl>
<dt><a href="#connect">connect(job, credentials, done)</a></dt>
<dd><p>Function: connect</p>
<p>Connect to an IRC server.</p>
</dd>
<dt><a href="#join">join(job, done)</a></dt>
<dd><p>Function: join</p>
<p>Join a room or private conversation.</p>
</dd>
<dt><a href="#leave">leave(job, done)</a></dt>
<dd><p>Function leave</p>
<p>Leave a room or private conversation.</p>
</dd>
<dt><a href="#send">send(job, done)</a></dt>
<dd><p>Function: send</p>
<p>Send a message to a room or private conversation.</p>
</dd>
<dt><a href="#update">update(job, credentials, done)</a></dt>
<dd><p>Function: update</p>
<p>Indicate a change (i.e. room topic update, or nickname change).</p>
</dd>
<dt><a href="#query">query(job, done)</a></dt>
<dd><p>Function: query</p>
<p>Indicate an intent to query something (e.g. get a list of users in a room).</p>
</dd>
<dt><a href="#disconnect">disconnect(job, done)</a></dt>
<dd><p>Disconnect IRC client</p>
</dd>
</dl>

<a name="schema"></a>

# schema
JSON schema defining the types this platform accepts.


In the below example, Sockethub will validate the incoming credentials object
against whatever is defined in the `credentials` portion of the schema
object.


It will also check if the incoming AS object uses a type which exists in the
`types` portion of the schema object (should be an array of type names).

* **NOTE**: For more information on using the credentials object from a client,
see [Sockethub Client](https://github.com/sockethub/sockethub/wiki/Sockethub-Client)

Valid AS object for setting IRC credentials:

**Kind**: global variable  
**Example**  
```js
{
   type: 'credentials',
   context: 'irc',
   actor: {
     id: 'testuser@irc.host.net',
     type: 'person',
     name: 'Mr. Test User',
     userName: 'testuser'
   },
   object: {
     type: 'credentials',
     server: 'irc.host.net',
     nick: 'testuser',
     password: 'secret',
     port: 6697,
     secure: true,
     sasl: true
   }
 }
```
<a name="connect"></a>

# connect(job, credentials, done)
Function: connect

Connect to an IRC server.

**Kind**: global function  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object</p>
</td>
    </tr><tr>
    <td>credentials</td><td><code>object</code></td><td><p>credentials object</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done</p>
</td>
    </tr>  </tbody>
</table>

<a name="join"></a>

# join(job, done)
Function: join

Join a room or private conversation.

**Kind**: global function  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done</p>
</td>
    </tr>  </tbody>
</table>

**Example**  
```js
{
  context: 'irc',
  type: 'join',
  actor: {
    id: 'slvrbckt@irc.freenode.net',
    type: 'person',
    name: 'slvrbckt'
  },
  target: {
    id: 'irc.freenode.net/a-room',
    type: 'room',
    name: '#a-room'
  },
  object: {}
}
```
<a name="leave"></a>

# leave(job, done)
Function leave

Leave a room or private conversation.

**Kind**: global function  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done</p>
</td>
    </tr>  </tbody>
</table>

**Example**  
```js
{
  context: 'irc',
  type: 'leave',
  actor: {
    id: 'slvrbckt@irc.freenode.net',
    type: 'person',
    name: 'slvrbckt'
  },
  target: {
    id: 'irc.freenode.net/remotestorage',
    type: 'room',
    name: '#remotestorage'
  },
  object: {}
}
```
<a name="send"></a>

# send(job, done)
Function: send

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
    <td>job</td><td><code>object</code></td><td><p>activity streams object</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done</p>
</td>
    </tr>  </tbody>
</table>

**Example**  
```js
{
   context: 'irc',
   type: 'send',
   actor: {
     id: 'slvrbckt@irc.freenode.net',
     type: 'person',
     name: 'Nick Jennings',
     userName: 'slvrbckt'
   },
   target: {
     id: 'irc.freenode.net/remotestorage',
     type: 'room',
     name: '#remotestorage'
   },
   object: {
     type: 'message',
     content: 'Hello from Sockethub!'
   }
 }
```
<a name="update"></a>

# update(job, credentials, done)
Function: update

Indicate a change (i.e. room topic update, or nickname change).

**Kind**: global function  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object</p>
</td>
    </tr><tr>
    <td>credentials</td><td><code>object</code></td><td><p>credentials to verify this user is the right one</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done</p>
</td>
    </tr>  </tbody>
</table>

**Example**  
```js
change topic

{
  context: 'irc',
  type: 'update',
  actor: {
    id: 'slvrbckt@irc.freenode.net',
    type: 'person',
    name: 'Nick Jennings',
    userName: 'slvrbckt'
  },
  target: {
    id: 'irc.freenode.net/a-room',
    type: 'room',
    name: '#a-room'
  },
  object: {
    type: 'topic',
    content: 'New version of Sockethub released!'
  }
}
```
**Example**  
```js
change nickname
 {
   context: 'irc'
   type: 'update',
   actor: {
     id: 'slvrbckt@irc.freenode.net',
     type: 'person',
     name: 'slvrbckt'
   },
   object: {
     type: "address",
   },
   target: {
     id: 'cooldude@irc.freenode.net',
     type: 'person',
     name: 'cooldude'
   }
 }
```
<a name="query"></a>

# query(job, done)
Function: query

Indicate an intent to query something (e.g. get a list of users in a room).

**Kind**: global function  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object</p>
</td>
    </tr><tr>
    <td>done</td><td><code>object</code></td><td><p>callback when job is done</p>
</td>
    </tr>  </tbody>
</table>

**Example**  
```js
{
   context: 'irc',
   type: 'query',
   actor: {
     id: 'slvrbckt@irc.freenode.net',
     type: 'person',
     name: 'Nick Jennings',
     userName: 'slvrbckt'
   },
   target: {
     id: 'irc.freenode.net/a-room',
     type: 'room',
     name: '#a-room'
   },
   object: {
     type: 'attendance'
   }
 }


 // The above object might return:
 {
   context: 'irc',
   type: 'query',
   actor: {
     id: 'irc.freenode.net/a-room',
     type: 'room',
     name: '#a-room'
   },
   target: {},
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
<a name="disconnect"></a>

# disconnect(job, done)
Disconnect IRC client

**Kind**: global function  
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>job</td><td><code>object</code></td><td><p>activity streams object</p>
</td>
    </tr><tr>
    <td>done</td><td></td><td></td>
    </tr>  </tbody>
</table>

**Example**  
```js
{
   context: 'irc',
   type: 'disconnect',
   actor: {
     id: 'slvrbckt@irc.freenode.net',
     type: 'person'
   }
 }
```
