[![Sockethub](http://sockethub.org/img/sockethub-logo.svg)](http://sockethub.org)

The polyglot approach to the federated social web.

[![Flattr this](http://api.flattr.com/button/flattr-badge-large.png)](http://flattr.com/thing/1154379/Sockethub)

[![Build Status](https://secure.travis-ci.org/sockethub/sockethub.png)](http://travis-ci.org/sockethub/sockethub)

about
-----
Sockethub is a polyglot (speaking many different protocols and APIs) messaging service for social and other interactive messaging applications. Not only does it assist [unhosted web app](http://unhosted.org) developers by providing server-independent, server-side functionality, but it also can be used a tool for many different applications, large and small.

Example uses of sockethub are, writing and receiving messages (SMTP, Facebook, Twitter, Diaspora), instant messaging (XMPP, AIM, MSN), discovery (WebFinger, OpenGraph). The architecture of sockethub is extensible and supports implementation of more 'platforms' to carry out tasks, sockethub can be run on your own server, or provided as a service by a service provider, or app store.

status
------
Sockethub is currently in very early stages of development, though already basic proof of concepts for XMPP are working, as well as progress being made to support SMTP, Facebook and Twitter. The implementtion of each 'platform' is very modular and straightforward to implement. If you are a developer looking to contribute, open an issue and explain what you'd like to implement for help getting started.

features
--------
We use Activity Streams to map the various social networks terms to a set of 'verbs' which identify the underlying action. For example,for a facebook friend request/accept cycle, we would use the activity stream verbs 'request-friend', 'remove-friend', 'make-friend'.

Below is a list of platforms we're currently working on and their activity stream verbs (when appropriate) or verbs that are specific to sockethub, both the completed and not yet implemented ones. They all map to the platforms actions.

##### [platform] - [verbs]
 * Email - <kbd>![completed](http://sockethub.org/img/checkmark.png) send</kbd> <kbd>fetch</kbd>
 * XMPP - <kbd>![completed](http://sockethub.org/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png) request-friend</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png) remove-friend</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png) make-friend</kbd>
 * Facebook - <kbd>![completed](http://sockethub.org/img/checkmark.png) post</kbd> <kbd>send</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png)fetch</kbd> <kbd>request-friend</kbd> <kbd>remove-friend</kbd> <kbd>make-friend</kbd> <kbd>like</kbd>
 * Twitter - <kbd>![completed](http://sockethub.org/img/checkmark.png) post</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd> <kbd>send</kbd> <kbd>fetch</kbd>
 * RSS - <kbd>![completed](http://sockethub.org/img/checkmark.png) fetch</kbd>
 * WebFinger - <kbd>search</kbd>
 * IRC - <kbd>send</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd>

architecture overview
---------------------

Check out [doc/architecture_overview.md](doc/architecture_overview.md) for a little more information *("under the hood")* on the implementation details of Sockethub

installation & setup
--------------------

### prerequisites

  * redis server

  You will need to have a redis server (version 2.x or greater) up and running.

  NOTE: **version 2.x** or greater required as Sockethub makes extensive use of the `BRPOP` command.

  * node.js package dependencies

  Some of the node.js packages require operating system libraries in order to function correctly.
      - simple-xmpp : libexpat1 libexpat1-dev libicu-dev

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

    [sockethub]$ node sockethub.js

  Once sockethub is running, you can visit `http://localhost:10550/examples/` to see some example apps (under development).

**remoteStorage.js note:** *trying to use a file:// URL for this will not work because remoteStorage.js depends on having a localStorage origin available.*

### writing an app that uses it

Your best bet is to include [the sockethub.js client](https://github.com/sockethub/sockethub-client).

### adding a platform

See [doc/adding_a_platform.md](doc/adding_a_platform.md)

license
-------
Sockethub is licensed under the [AGPLv3](https://github.com/sockethub/sockethub/blob/master/LICENSE)


credits
-------
Project maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/img/nlnet-logo.svg)](http://nlnet.nl)

