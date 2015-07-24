[![Sockethub](http://sockethub.org/res/img/sockethub-logo.svg)](http://sockethub.org)

A polyglot messaging service.

[![Build Status](http://img.shields.io/travis/sockethub/sockethub.svg?style=flat)](https://travis-ci.org/sockethub/sockethub)
[![Dependency Status](http://img.shields.io/david/sockethub/sockethub.svg?style=flat)](https://david-dm.org/sockethub/sockethub#info=dependencies)
[![devDependency Status](http://img.shields.io/david/dev/sockethub/sockethub.svg?style=flat)](https://david-dm.org/sockethub/sockethub#info=devDependencies)
[![Code Climate](http://img.shields.io/codeclimate/github/sockethub/sockethub.svg?style=flat)](https://codeclimate.com/github/sockethub/sockethub)
[![License](https://img.shields.io/npm/l/sockethub.svg?style=flat)](https://raw.githubusercontent.com/sockethub/sockethub/master/LICENSE)
[![Release](http://img.shields.io/github/release/sockethub/sockethub.svg?style=flat)](https://github.com/silverbucket/sockethub/releases)

[![Flattr this](http://api.flattr.com/button/flattr-badge-large.png)](http://flattr.com/thing/1154379/Sockethub)

# About
Sockethub is a polyglot (speaking many different protocols and APIs) messaging service for social and other interactive messaging applications. Not only does it assist [unhosted](http://unhosted.org) and [noBackend](http://nobackend.org) web application developers by providing server-independent, server-side functionality, but it also can be used as a back-end tool (invisible to the user) for many different applications, large and small.

Example uses of sockethub are: writing and receiving messages (SMTP, Facebook, Twitter, Diaspora), instant messaging (XMPP, AIM, MSN, IRC), discovery (WebFinger, RDF(a)). The architecture of sockethub is extensible and supports easy implementation of additional 'platforms' to carry out tasks, sockethub can be run on your own server, or provided as a service by a service provider, or app store.

# Status
Sockethub is currently under active development, several platforms are being worked on (details below) and are at varying levels of completeness.

For more information on platform development, see the [platform overview](doc/platform_overview.md).

# Features
We use Activity Streams to map the various social networks terms to a set of 'verbs' which identify the underlying action. For example,for a facebook friend request/accept cycle, we would use the activity stream verbs 'request-friend', 'remove-friend', 'make-friend'.

Below is a list of platforms we're currently working on and their activity stream verbs (when appropriate) or verbs that are specific to sockethub, both the completed and not yet implemented ones. They all map to the platforms actions.

##### [platform] - [verbs]
* [Email](https://github.com/sockethub/sockethub-platform-email) *(SMTP, IMAP)* - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) fetch (imap)</kbd>
* [XMPP](https://github.com/sockethub/sockethub-platform-xmpp) - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) request-friend</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) remove-friend</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) make-friend</kbd>
* [Facebook](https://github.com/sockethub/sockethub-platform-facebook) - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) post</kbd> <kbd>send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png)fetch</kbd> <kbd>request-friend</kbd> <kbd>remove-friend</kbd> <kbd>make-friend</kbd> <kbd>like</kbd>
* [Twitter](https://github.com/sockethub/sockethub-platform-twitter) - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) post</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd> <kbd>send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) fetch</kbd>
* [Feeds](https://github.com/sockethub/sockethub-platform-feeds) *(RSS, Atom)* - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) fetch</kbd>
* [IRC](https://github.com/sockethub/sockethub-platform-irc) - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) join</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) leave</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) observe</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) update</kbd>
* pump.io - <kbd>post</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd> <kbd>send</kbd> <kbd>fetch</kbd>
* WhatsApp - <kbd>send</kbd> <kbd>request-friend</kbd> <kbd>remove-friend</kbd> <kbd>make-friend</kbd>
* WebFinger - <kbd>search</kbd>
* RDF - <kbd>search</kbd> <kbd>fetch</kbd>
* Bitcoin - *(to be evaluated)* <kbd>send</kbd> <kbd>receive</kbd> ...
* FireFoxSync - *(to be evaluated)*
* WebRTC - *(to be evaluated)*


# Setup

`$ npm install`

# Running

`$ DEBUG=* bin/sockethub --dev`

You should then be able to browse to `http://localhost:10550` and try out the examples.

# Environment Variables

* PORT
Defaults to `10550`
* HOST
Defaults to `localhost`
* DEBUG
Specify the namespace to console log, ie. `sockethub*` will print all sockethub related debug statements, whereas `*` will also print any other modules debug statements that use the `debug` module.

# Command-line params
```
  --help  : this help screen
  --info  : displays some basic runtime info

  --dev : enabled examples page and serves helper files like jquery

  --host  : hostname to bind to
  --port  : port to bind to
```

# Docs

*Currently being worked on*


# License

Sockethub is licensed under the [LGPL](https://github.com/sockethub/sockethub/blob/master/LICENSE)

# Credits

Project maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/res/img/nlnet-logo.svg)](http://nlnet.nl)

