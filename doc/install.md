# install

* check out the repo
* make sure you have the following things installed:
  - nodejs
  - redis-server

on ubuntu you can use:

````
    sudo apt-get install redis-server nodejs
````

* cd into the root of the repo and type:
`````
    npm install

    cp config.js.template config.js

    cp config.secrets.js.template config.secrets.js

    node sockethub.js
`````
* browse to http://localhost:10550/ and play around with the examples
* to let your unhosted web app talk to your sockethub instance, follow [getting started](getting_started.md)
* be aware of http://dev.mensfeld.pl/2012/07/err-unknown-command-blpop-for-resque-redis-and-rails/


# further reading

For an architectural overview of sockethub, see [architecture_overview.md](architecture_overview.md).

For details on using sockethub from your web app, see [platform_overview.md](platform_overview), and the [sockethub-client repository](https://github.com/sockethub/sockethub-client).

For creating your own sockethub platform, see (adding_a_platform.md)[adding_a_platform.md].

