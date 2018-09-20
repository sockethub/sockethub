# Release notes

## 3.0.0

### Client
- Renamed `failure` event to `failed`

### Core
- Added broadcast of sent-messages from one client to other clients using the same platform instance. This enables two 
separate instances of the same user to get the words they typed from one window in the other as well.

### Worker
- A worker is created for each physical client websocket connection to sockethub, and can access a shared pool of 
platformInstances (only after account authentication from the user).

- Many improvements to error handling, cleanup and re-initialization during unexpected failures.


### Platforms
- A platform instance a single instance of a socket connection to the target (eq. `irc`, `xmpp`), and can be accessed
from any worker that needs it (only after account authentication from the user).

- Added `updateCredentials` method passed to platforms during initialization, as part of `cfg` object. See IRC platform
for example of usage.

- Removed `connection-manager` dependency from project, as we no longer share connection objects, but rather a 
platformInstance is essentially the connection object.

#### IRC
- Job completed messages are now confirmations that the IRC message was sent, due to PONG messages being sent after 
every PRIVMSG message. `__jobQueue`

- client connecting can only happen once, so if multiple client requests come in and one request is in the process of 
connecting, the other requests wait for it to connect with a 20s timeout. `__clientConnecting`

- Implemented ability to rename nick, using `updateCredentials` along with internal tracking of valid user nicks 
(because we can't control what name the incoming messages on the irc socket give us, so we keep a mapping). 
`__handledActors`
