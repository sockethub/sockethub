sockethub [![Build Status](https://secure.travis-ci.org/sockethub/sockethub.png)](http://travis-ci.org/sockethub/sockethub)
=========

the polyglot approach to the federated social web.

installation & setup:
---------------------

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

**Note** *that trying to use a file:// URL for this will not work because remoteStorage.js depends on having a localStorage origin available.*

license
-------
sockethub is licensed under the [AGPLv3](https://github.com/sockethub/sockethub/blob/master/LICENSE)
