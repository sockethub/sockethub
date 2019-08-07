[![Sockethub](http://sockethub.org/res/img/sockethub-logo.svg)](http://sockethub.org)

A protocol gateway for the web.

[![Build Status](http://img.shields.io/travis/sockethub/sockethub.svg?style=flat)](https://travis-ci.org/sockethub/sockethub)
[![Dependency Status](http://img.shields.io/david/sockethub/sockethub.svg?style=flat)](https://david-dm.org/sockethub/sockethub#info=dependencies)
[![devDependency Status](http://img.shields.io/david/dev/sockethub/sockethub.svg?style=flat)](https://david-dm.org/sockethub/sockethub#info=devDependencies)
[![Code Climate](http://img.shields.io/codeclimate/github/sockethub/sockethub.svg?style=flat)](https://codeclimate.com/github/sockethub/sockethub)
[![License](https://img.shields.io/npm/l/sockethub.svg?style=flat)](https://raw.githubusercontent.com/sockethub/sockethub/master/LICENSE)
[![Release](https://img.shields.io/npm/v/sockethub.svg?style=flat)](https://github.com/sockethub/sockethub/releases)

# About
Sockethub is a translation layer for web applications to communicate with other protocols and services that are traditionally either inaccessible or impractical to use from in-browser JavaScript.

Using [ActivityStream](http://activitystrea.ms/) (AS) objects to pass messages to and from the web-app, Sockethub acts as a sort of smart web-proxy and can maintain state, connect to sockets or REST enpoints that would otherwise be restricted from an application running in the browser. Originally inspired as a sister project to [RemoteStorage](https://remotestorage.io) and assisting in the development of [unhosted](http://unhosted.org) or [noBackend](http://nobackend.org) applications, Sockethubs functionality can also fit into a more traditional development stack, removing the need for custom code to handle various protocol-specifics at the applicaton layer.

Example uses of sockethub are: writing and receiving messages (SMTP, Facebook, Twitter), instant messaging (XMPP, IRC, MSN, FB Messenger, Hangouts), discovery (WebFinger, RDF(a)). The architecture of Sockethub is extensible and supports easy implementation of additional 'platforms' to carry out tasks.

# Docs

See the [Sockethub wiki](https://github.com/sockethub/sockethub/wiki) for documentation.

# Features

We use ActivityStreams to map the various actions of a platform to a set of AS '@type's which identify the underlying action. For example, using the XMPP  platform, a friend request/accept cycle would use the activity stream types 'request-friend', 'remove-friend', 'make-friend'.

Below is a list of platform contexts we're currently working on and their types, both the completed and not yet implemented ones. They are all implemented in the sockethub platform (each have their own repository) and can be enabled/disabled in the config.json.

## Implemented

Full or partial implementations, being used.

| Platform (@context) | Type (@type) |
| ------------------- | ------------ |
| [XMPP](https://github.com/sockethub/sockethub-platform-xmpp) | <kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) request-friend</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) remove-friend</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) make-friend</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) update</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png)  join</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) observe</kbd>|
| [Feeds](https://github.com/sockethub/sockethub-platform-feeds) *(RSS, Atom)* | <kbd>![completed](http://sockethub.org/res/img/checkmark.png) fetch</kbd> |
| [IRC](https://github.com/sockethub/sockethub-platform-irc) | <kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) join</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) leave</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) observe</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) update</kbd> |

## Out of date

Implemented in a previous major release of Sockethub, never ported to the current release and unmaintained.

| Platform (@context) | Type (@type) |
| ------------------- | ------------ |
| [Email](https://github.com/sockethub/sockethub-platform-email) *(SMTP, IMAP)* *to port* | <kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) fetch (imap)</kbd> |
| [Facebook](https://github.com/sockethub/sockethub-platform-facebook) *to port* | <kbd>![completed](http://sockethub.org/res/img/checkmark.png) post</kbd> <kbd>send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png)fetch</kbd> <kbd>request-friend</kbd> <kbd>remove-friend</kbd> <kbd>make-friend</kbd> <kbd>like</kbd> |
| [Twitter](https://github.com/sockethub/sockethub-platform-twitter) *to port* | <kbd>![completed](http://sockethub.org/res/img/checkmark.png) post</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd> <kbd>send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) fetch</kbd> |

## Future consideration

List of possible future platforms and their potentials verb types.

| Platform (@context) | Type (@type) |
| ------------------- | ------------ |
| pump.io | <kbd>post</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd> <kbd>send</kbd> <kbd>fetch</kbd> |
| WhatsApp | <kbd>send</kbd> <kbd>request-friend</kbd> <kbd>remove-friend</kbd> <kbd>make-friend</kbd> |
| WebFinger | <kbd>search</kbd> |
| RDF | <kbd>search</kbd> <kbd>fetch</kbd> |
| Bitcoin (e.g. sending signed transactions to a node) | *(to be evaluated)* <kbd>send</kbd> <kbd>receive</kbd> ... |
| Ethereum (e.g. contract events) | *(to be evaluated)* |
| WebRTC (signaling) | *(to be evaluated)* |
| Signal | *(to be evaluated)* |
| [MicroPub](https://indieweb.org/micropub) (IndieWeb, ...) | *(to be evaluated)* |
| [OStatus](https://en.wikipedia.org/wiki/OStatus) (GNUSocial, Mastodon, ...) | *(to be evaluated)* |

# Setup

`$ npm install`

# Running

`$ DEBUG=sockethub* bin/sockethub --examples`

You should then be able to browse to `http://localhost:10550` and try out the examples.

# Running using Docker Compose

Requires [Docker Compose](https://docs.docker.com/compose/) 1.10.0+

`$ docker-compose up`

> If you’re using Docker natively on Linux, Docker for Mac, or Docker for
> Windows, then sockethub should now be listening on port 10550 on your Docker
> daemon host. Point your web browser to http://localhost:10550 to find
> sockethub. If this doesn’t resolve, you can also try
> http://0.0.0.0:10550.

> If you’re using Docker Machine on a Mac or Windows, use docker-machine ip
> MACHINE_VM to get the IP address of your Docker host. Then, open
> http://MACHINE_VM_IP:10550 in a browser.

# Environment Variables

* PORT
Defaults to `10550`
* HOST
Defaults to `localhost`
* DEBUG
Specify the namespace to console log, ie. `sockethub*` will print all sockethub related debug statements, whereas `*` will also print any other modules debug statements that use the `debug` module.

* REDIS_PORT
Defaults to `6379`
* REDIS_HOST
Defaults to `localhost`

***OR***

* REDIS_URL
Overrides `REDIS_HOST` and `REDIS_PORT`, can specify a full redis connect URL (eq. `redis://username:password@host:port`)

# Command-line params
```
  --help       : this help screen
  --info       : displays some basic runtime info

  --examples   : enabled examples page and serves helper files like jquery

  --host       : hostname to bind to
  --port       : port to bind to
```

# License

Sockethub is licensed under the [LGPL](https://github.com/sockethub/sockethub/blob/master/LICENSE)

# Credits

Project created and maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/res/img/nlnet-logo.svg)](http://nlnet.nl)

