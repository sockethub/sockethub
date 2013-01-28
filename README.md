sockethub [![Build Status](https://secure.travis-ci.org/sockethub/sockethub.png)](http://travis-ci.org/sockethub/sockethub)
=========

the polyglot approach to the federated social web.

about
-----

The sockethub project aims to implement a "polyglot" approach to social networking and other interactive messaging applications, as well as assist [unhosted web apps](http://unhosted.org) in providing server-independant, server-side functionality.

Example uses of sockethub are, writing and receiving messages (SMTP, Facebook, Twitter, Diaspora), instant messaging (XMPP, AIM, MSN), discovery (WebFinger, OpenGraph). The architecture of sockethub is extensible and supports implementation of more 'platforms' to carry out tasks, sockethub can be run on your own server, or provided as a service by a service provider, or app store.

status
------
Sockethub is currently in very early stages of development, though already basic proof of concepts for XMPP are working, as well as progress being made for SMTP support. The implementtion of each 'platform' is very modular and straightforward to implement. If you are a developer looking to contribute, open an issue and explain what you'd like to implement for help getting started.


installation & setup
--------------------

### prerequisites

  * redis server

  You will need to have a redis server up and running.

### install

    $ git clone git@github.com:sockethub/sockethub.git

### setup

    [sockethub]$ npm install
    [sockethub]$ cp config.js.template config.js
    [sockethub]$ node sockethub.js

once sockethub is running, you can visit http://localhost:10550 to see the basic pinger health checker.

**remoteStorage.js note:** *trying to use a file:// URL for this will not work because remoteStorage.js depends on having a localStorage origin available.*

license
-------
sockethub is licensed under the [AGPLv3](https://github.com/sockethub/sockethub/blob/master/LICENSE)
