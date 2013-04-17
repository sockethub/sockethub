[![Sockethub](http://sockethub.org/img/sockethub-logo.svg)](http://sockethub.org)

The polyglot approach to the federated social web.

[![Build Status](https://secure.travis-ci.org/sockethub/sockethub.png)](http://travis-ci.org/sockethub/sockethub)

about
-----
Sockethub aims to implement a polyglot (speaking all the languages of the interwebs) approach to social and other interactive messaging applications, and assist [unhosted web app](http://unhosted.org) developers by providing server-independent, server-side functionality.

Example uses of sockethub are, writing and receiving messages (SMTP, Facebook, Twitter, Diaspora), instant messaging (XMPP, AIM, MSN), discovery (WebFinger, OpenGraph). The architecture of sockethub is extensible and supports implementation of more 'platforms' to carry out tasks, sockethub can be run on your own server, or provided as a service by a service provider, or app store.

status
------
Sockethub is currently in very early stages of development, though already basic proof of concepts for XMPP are working, as well as progress being made to support SMTP, Facebook and Twitter. The implementtion of each 'platform' is very modular and straightforward to implement. If you are a developer looking to contribute, open an issue and explain what you'd like to implement for help getting started.

features
--------
We use Activity Streams to map the various social networks terms to a set of 'verbs' which identify the underlying action. For example,for a facebook friend request/accept cycle, we would use the activity stream verbs 'request-friend', 'remove-friend', 'make-friend'.  

Below is a list of platforms we're currently working on and their activity stream verbs (when appropriate) or verbs that are specific to sockethub, both the completed and not yet implemented ones. They all map to the platforms actions.

##### [platform] - [verbs]
 * Email - <kbd>![completed](http://sockethub.org/img/checkmark.png) send</kbd> <kbd>follow (poll for incoming messages)</kbd>
 * XMPP - <kbd>![completed](http://sockethub.org/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png) request-friend</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png) remove-friend</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png) make-friend</kbd>
 * Facebook - <kbd>![completed](http://sockethub.org/img/checkmark.png) post</kbd> <kbd>send</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd> <kbd>request-friend</kbd> <kbd>remove-friend</kbd> <kbd>make-friend</kbd> <kbd>like</kbd>
 * Twitter - <kbd>![completed](http://sockethub.org/img/checkmark.png) post</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd> <kbd>send</kbd>
 * RSS - <kbd>![completed](http://sockethub.org/img/checkmark.png) fetch</kbd>
 * WebFinger - <kbd>search</kbd>
 * IRC - <kbd>send</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd>

installation & setup
--------------------

### prerequisites

  * redis server

  You will need to have a redis server up and running.
  
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

    [sockethub]$ node sockethub.js

  Once sockethub is running, you can visit http://localhost:10550 to see the basic pinger health checker.

**remoteStorage.js note:** *trying to use a file:// URL for this will not work because remoteStorage.js depends on having a localStorage origin available.*

### adding a verb

Verbs are like commands. We try to follow ActivityStreams verbs as much as possible, but if no ActivityStreams verb exists for the command you need, then just invent a new name for it. Do try to make the verbs platform-independent. For instance, 'endorse' may be a better verb than 'retweet', because it abstracts from the Twitter platform for which you may be needing it.

Places to add your verb:

    lib/protocols/sockethub/verbs_schema.js
    lib/protocols/sockethub/protocol.js, module.exports.verbs
    lib/protocols/sockethub/protocol.js, module.exports.platforms (for each platform that will implement the new verb)
    lib/protocols/sockethub/platforms/*.js (add the o.<verb> function to actually implement it)

### adding a platform

A platform is a module that gives sockethub access to a "world", for instance the xmpp world, the smtp world, the facebook world, etcetera. It can be unclear whether something is a platform. For instance, would webfinger count as a platform? When in doubt, come to the irc channel (#sockethub on freenode), open a github issue about it on [gh:sockethub/sockethub](https://github.com/sockethub/sockethub/issues/), or ask your question in [unhosted@googlegroups](https://groups.google.com/forum#!forum/unhosted).

Places to add your platform:

    lib/protocols/sockethub/platforms/<platform>.js
    lib/protocols/sockethub/protocol.js, module.exports.platforms (also specify which verbs your platform will implement)
    config.js
    config.js.template

license
-------
Sockethub is licensed under the [AGPLv3](https://github.com/sockethub/sockethub/blob/master/LICENSE)


credits
-------
Project maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/img/nlnet-logo.svg)](http://nlnet.nl)
