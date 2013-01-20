sockethub [![Build Status](https://secure.travis-ci.org/sockethub/sockethub.png)](http://travis-ci.org/sockethub/sockethub)
=========

the polyglot approach to the federated social web.

to run:
-------

Do something like:

    npm install
    sudo apt-get install redis-server
    cp config.js.template config.js
    node sockethub.js

then use a webserver to serve up e.g. http://code.local/sockethub/html/index.html and point your browser to it.
Note that trying to use a file:// URL for this will not work
because remoteStorage.js depends on having a localStorage origin available.

license
-------
sockethub is licensed under the [AGPLv3](https://github.com/sockethub/sockethub/blob/master/LICENSE)
