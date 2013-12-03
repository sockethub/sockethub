[![Sockethub](http://sockethub.org/img/sockethub-logo.svg)](http://sockethub.org)

The polyglot approach to the federated social web.

[![Build Status](https://secure.travis-ci.org/sockethub/sockethub.png)](http://travis-ci.org/sockethub/sockethub)
[![devDependency Status](https://david-dm.org/sockethub/sockethub/dev-status.png)](https://david-dm.org/sockethub/sockethub#info=devDependencies)
[![Code Climate](https://codeclimate.com/github/sockethub/sockethub.png)](https://codeclimate.com/github/sockethub/sockethub)
[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/sockethub/sockethub/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

[![Flattr this](http://api.flattr.com/button/flattr-badge-large.png)](http://flattr.com/thing/1154379/Sockethub)

about
-----
Sockethub is a polyglot (speaking many different protocols and APIs) messaging service for social and other interactive messaging applications. Not only does it assist [unhosted](http://unhosted.org) and [noBackend](http://nobackend.org) web application developers by providing server-independent, server-side functionality, but it also can be used as a back-end tool (invisible to the user) for many different applications, large and small.

Example uses of sockethub are: writing and receiving messages (SMTP, Facebook, Twitter, Diaspora), instant messaging (XMPP, AIM, MSN, IRC), discovery (WebFinger, RDF(a)). The architecture of sockethub is extensible and supports easy implementation of additional 'platforms' to carry out tasks, sockethub can be run on your own server, or provided as a service by a service provider, or app store.

status
------
Sockethub is currently under active development, several platforms are being worked on (details below) and are at varying levels of completeness.

For more information on platform development, see the [platform overview](doc/platform_overview.md).

features
--------
We use Activity Streams to map the various social networks terms to a set of 'verbs' which identify the underlying action. For example,for a facebook friend request/accept cycle, we would use the activity stream verbs 'request-friend', 'remove-friend', 'make-friend'.

Below is a list of platforms we're currently working on and their activity stream verbs (when appropriate) or verbs that are specific to sockethub, both the completed and not yet implemented ones. They all map to the platforms actions.

##### [platform] - [verbs]
 * Email *(SMTP, IMAP)* - <kbd>![completed](http://sockethub.org/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png) fetch (imap)</kbd>
 * XMPP - <kbd>![completed](http://sockethub.org/img/checkmark.png) send</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png) request-friend</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png) remove-friend</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png) make-friend</kbd>
 * Facebook - <kbd>![completed](http://sockethub.org/img/checkmark.png) post</kbd> <kbd>send</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png)fetch</kbd> <kbd>request-friend</kbd> <kbd>remove-friend</kbd> <kbd>make-friend</kbd> <kbd>like</kbd>
 * Twitter - <kbd>![completed](http://sockethub.org/img/checkmark.png) post</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd> <kbd>send</kbd> <kbd>![completed](http://sockethub.org/img/checkmark.png) fetch</kbd>
 * Feeds *(RSS, Atom)* - <kbd>![completed](http://sockethub.org/img/checkmark.png) fetch</kbd>
 * IRC - <kbd>![completed](http://sockethub.org/img/checkmark.png) send</kbd> <kbd>join</kbd> <kbd>leave</kbd>
 * pump.io - <kbd>post</kbd> <kbd>follow</kbd> <kbd>unfollow</kbd> <kbd>send</kbd> <kbd>fetch</kbd>
 * WebFinger - <kbd>search</kbd>
 * RDF - <kbd>search</kbd> <kbd>fetch</kbd>
 * Bitcoin - *(to be evaluated)* <kbd>send</kbd> <kbd>receive</kbd> ...
 * FireFoxSync - *(to be evaluated)*
 * WebRTC - *(to be evaluated)*

architecture overview
---------------------

Check out the [architecture overview](doc/architecture_overview.md) for a little more information *("under the hood")* on the implementation details of Sockethub.

installation & setup
--------------------

### prerequisites

  * redis server

  You will need to have a redis server (version 2.x or greater) up and running.

  NOTE: redis **version 2.x** or greater required as Sockethub makes extensive use of the `BLPOP` and `RPUSH` commands.

  * node.js package dependencies

  Some of the node.js packages require operating system libraries in order to function correctly.
      - simple-xmpp : `libexpat1` `libicu-dev`
      - node-stringprep (dependency of several packages) : `libicu-dev`

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

license
-------

Sockethub is licensed under the [AGPLv3](https://github.com/sockethub/sockethub/blob/master/LICENSE)

apps built on sockethub
-----------------------

Sockethubg is still a young project, however ongoing work is being done to build applications ontop of it. Here are some existing projects.

* [Dogfeed](http://github.com/silverbucket/dogfeed) an unhosted feed reader (RSS/Atom currently supported) [stable]
* [Dogtalk](http://github.com/silverbucket/dogtalk) an unhosted chat client (XMPP & IRC currently supported) [alpha]
* [Unhosted mail](http://github.com/nilclass/unhosted-mail) an unhosted email client [experimental / alpha]

credits
-------

Project maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/img/nlnet-logo.svg)](http://nlnet.nl)

