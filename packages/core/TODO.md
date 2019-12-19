[ ] remotestorage support
[x] schema validation
[x] connection manager integration
[x] store
[ ] socket.io redis state sharing
[ ] clustering
[ ] query the server for platforms list & other meta-data from the client-side
[ ] graceful shutdown and restarting
  [ ] kue
  [ ] worker
  [ ] platforms
  [ ] connection manager
  [ ] sockethub.ts
[x] reconnects need to resend credentials and activity-objects
[x] secrets

## notes
- if an `objectType:'credentials'` comes in as a 'message' event, how should
  we handle it?
[x] passing reason during job failure
- cant use 'error' name as emit event?
[ ] figure out a way to allow for special objects from platforms, without ignoring failed activity stream schema checks
[ ] investigate socket-relay idea. https://github.com/ircanywhere/irc-factory/blob/master/lib/api.js#L198-L201

### Workers
Should workers spawned for each session? or one per platform? or both? 

It kinda makes sense that there are no workers running by default, and when a new session connects, a new worker is spawned and handles their requests. Care must be taken to make sure the worker doesn't build up memory leaks, and data is purged, but logically it seems cleaner overall.
 
 #### 1 worker per sessions:
 - connects can take a while, you can have workers process requests concurrently, but only up to a point. 
 - when there are crashes and client connections are lost. it's only in the realm of a single sessions, so other clients aren't effected.
 - if you are mainly operating in IRC, but then send a tweet and something crashes, you could loose your IRC session connection.

 #### 1 worker per platform:
 - if 100 sessions are connected, that's 100 worker objects operating
 - if the IRC platform worker crashes, all people using sockethub loose their IRC conenctions.
 - if a different platform worker crashes, the IRC sessions are not effected
