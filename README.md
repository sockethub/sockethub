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
    [sockethub]$ cp config.secrets.js.template config.secrets.js

  You will want to edit your config.secrets.js file and add your own secret string to use during the register command to ensure only apps can connect that have the right secret.

    [sockethub]$ node sockethub.js

  Once sockethub is running, you can visit http://localhost:10550 to see the basic pinger health checker.

**remoteStorage.js note:** *trying to use a file:// URL for this will not work because remoteStorage.js depends on having a localStorage origin available.*

license
-------
Sockethub is licensed under the [AGPLv3](https://github.com/sockethub/sockethub/blob/master/LICENSE)


credits
-------
Project maintained by [Nick Jennings](http://github.com/silverbucket)

Logo design by [Jan-Christoph Borchardt](http://jancborchardt.net)

Sponsored by [NLNET](http://nlnet.nl)

[![NLNET Logo](http://sockethub.org/img/nlnet-logo.svg)](http://nlnet.nl)
