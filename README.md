# Sockethub v1.x Branch

Experimental branch, possible replacement of sockethub core for a future 1.0 release.

# Setup

`$ npm install`

`$ DEBUG=soockethub* bin/sockethub --dev`

You should then be able to browse to `http://localhost:10550` and try out the examples.


# Dev Notes

goals of this branch are:
* ActivityStreams 2.0 compliance
* Improved modularity between components
* Use of existing libraries to reduce total code size (express, socket.io)
* Re-approach the managing of platforms:
    - memory footprint
    - memory protection
    - restarting platforms without effecting the rest of the application
    - shared application state
    - detecting unresponsive platform sessions efficiently
    - communicating events and errors to client clearly


# TODO

* `Post` and `Share` removed in favor of the more generally applicable `Create` or `Add`