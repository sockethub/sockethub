# install
* check out the repo
* make sure you have nodejs installed
* cd into the root of the repo and type:
````
sudo apt-get install redis-server
npm install
cp config.js.template config.js
cp config.secrets.js.template config.secrets.js
node sockethub.js
````
* browse to http://localhost:10550/ and play around with the examples
* to let your unhosted web app talk to your sockethub instance, follow [getting started](getting_started.md)
* be aware of http://dev.mensfeld.pl/2012/07/err-unknown-command-blpop-for-resque-redis-and-rails/
