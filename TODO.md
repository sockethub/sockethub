[ ] remotestorage support
[x] schema validation
[ ] connection manager integration
[x] store
[ ] sockethub.io redis state sharing
[ ] clustering
[ ] query the server for platforms list & other meta-data from the client-side
[ ] graceful shutdown and restarting
  [ ] kue
  [ ] worker
  [ ] platforms
  [ ] connection manager
  [ ] sockethub.js

## notes
- if an `objectType:'credentials'` comes in as a 'message' event, how should
  we handle it?
[x] passing reason during job failure
- cant use 'error' name as emit event?
