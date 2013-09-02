# install

## prerequisites

  * redis server

  You will need to have a redis server (version 2.x or greater) up and running.

  NOTE: **version 2.x** or greater required as Sockethub makes extensive use of the `BLPOP` and `RPUSH` commands.

  * node.js package dependencies

  Some of the node.js packages require operating system libraries in order to function correctly.
      - simple-xmpp : `libexpat1` `libicu-dev`
      - node-stringprep (dependency of several packages) : `libicu-dev`

  NOTE: **version v0.10.x** or greater required due to module dependencies.

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
`````

* browse to http://localhost:10550/examples/ and play around with the examples
* to let your unhosted web app talk to your sockethub instance, follow [getting started](getting_started.md)
* be aware of http://dev.mensfeld.pl/2012/07/err-unknown-command-blpop-for-resque-redis-and-rails/


# further reading

For an architectural overview of sockethub, see [architecture_overview.md](architecture_overview.md).

For details on using sockethub from your web app, see [platform_overview.md](platform_overview), and the [sockethub-client repository](https://github.com/sockethub/sockethub-client).

For creating your own sockethub platform, see (adding_a_platform.md)[adding_a_platform.md].

