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

# Docs

See the [Sockethub wiki](https://github/sockethub/sockethub/wiki) for documentation.

<<<<<<< HEAD
**WARNING: In preparation for version 1.0, Sockethub is undergoing a
rewrite/refactoring with breaking changes to the APIs and data formats. Active
development branched off of master and is happening in `experimental_v_1_0`. If
you want to use it and/or contribute to the development, please join us in
`#sockethub` on Freenode.**

features
--------
=======
# Features
>>>>>>> experimental_v1_0
We use Activity Streams to map the various social networks terms to a set of 'verbs' which identify the underlying action. For example,for a facebook friend request/accept cycle, we would use the activity stream verbs 'request-friend', 'remove-friend', 'make-friend'.

Below is a list of platforms we're currently working on and their activity stream verbs (when appropriate) or verbs that are specific to sockethub, both the completed and not yet implemented ones. They all map to the platforms actions.

##### [platform] - [verbs]
<<<<<<< HEAD
* Email *(SMTP, IMAP)* - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) fetch (imap)</kbd>
* XMPP - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) request-friend</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) remove-friend</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) make-friend</kbd>
* Facebook - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) post</kbd> <kbd>send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png)fetch</kbd> <kbd>request-friend</kbd> <kbd>remove-friend</kbd> <kbd>make-friend</kbd> <kbd>like</kbd>
* Twitter - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) post</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd> <kbd>send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) fetch</kbd>
* Feeds *(RSS, Atom)* - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) fetch</kbd>
* IRC - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) join</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) leave</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) observe</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) update</kbd>
=======
* *to port* [Email](https://github.com/sockethub/sockethub-platform-email) *(SMTP, IMAP)* - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) fetch (imap)</kbd>
* *to port* [XMPP](https://github.com/sockethub/sockethub-platform-xmpp) - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) request-friend</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) remove-friend</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) make-friend</kbd>
* *to port* [Facebook](https://github.com/sockethub/sockethub-platform-facebook) - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) post</kbd> <kbd>send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png)fetch</kbd> <kbd>request-friend</kbd> <kbd>remove-friend</kbd> <kbd>make-friend</kbd> <kbd>like</kbd>
* *to port* [Twitter](https://github.com/sockethub/sockethub-platform-twitter) - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) post</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd> <kbd>send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) fetch</kbd>
* [Feeds](https://github.com/sockethub/sockethub-platform-feeds) *(RSS, Atom)* - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) fetch</kbd>
* [IRC](https://github.com/sockethub/sockethub-platform-irc) - <kbd>![completed](http://sockethub.org/res/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) join</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) leave</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) observe</kbd> <kbd>![completed](http://sockethub.org/res/img/checkmark.png) update</kbd>
>>>>>>> experimental_v1_0
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

`$ DEBUG=sockethub* bin/sockethub --examples`

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
  --help       : this help screen
  --info       : displays some basic runtime info

  --examples   : enabled examples page and serves helper files like jquery

  --host       : hostname to bind to
  --port       : port to bind to
```

# License

Sockethub is licensed under the [LGPL](https://github.com/sockethub/sockethub/blob/master/LICENSE)

<<<<<<< HEAD
    **node-stringprep** *(dependency of several packages)* : `libicu-dev`

  NOTE: node **version v0.10.x** or greater required due to module dependencies.

  Instructions on installing node v0.10.x on Ubuntu 12.04 LTS see this

		$ sudo apt-get update
		$ sudo apt-get install python-software-properties python g++ make
		$ sudo add-apt-repository ppa:chris-lea/node.js
		$ sudo apt-get update
		$ sudo apt-get install nodejs

  (from: http://kb.solarvps.com/node-js/installing-node-js-on-ubuntu-12-04-lts/)


### install

    $ git clone git@github.com:sockethub/sockethub.git

### setup

    [sockethub]$ npm install
    [sockethub]$ cp config.js.template config.js
    [sockethub]$ cp config.secrets.js.template config.secrets.js

  You will want to edit your config.secrets.js file and add your own secret string to use during the register command to ensure only apps can connect that have the right secret.

    [sockethub]$ git submodule init && git submodule update

  You'll need the submodules for the examples to run (uses
  [sockethub-client](https://github.com/sockethub/sockethub-client/))

    [sockethub]$ npm test

  Verify all tests pass, then you should be good to go.

    [sockethub]$ bin/sockethub

  Once sockethub is running, you can visit `http://localhost:10550/examples/` to see some example apps (under development).

**remoteStorage.js note:** *trying to use a file:// URL for this will not work because remoteStorage.js depends on having a localStorage origin available.*

docs
----

The [Getting Started Guide](https://github.com/sockethub/sockethub/blob/master/doc/getting_started.md) is a good starting place to find links to more specific documentation about Sockethub or SockethubClient.

[Sockethub Internals](http://sockethub.org/doc/developer)


license
-------

Sockethub is licensed under the [LGPL](https://github.com/sockethub/sockethub/blob/master/LICENSE)

credits
-------
=======
# Credits
>>>>>>> experimental_v1_0

Project maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/res/img/nlnet-logo.svg)](http://nlnet.nl)

