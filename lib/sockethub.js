var nconf      = require('nconf'),
    path       = require('path'),
    assert     = require('assert'),
    debug      = require('debug')('sockethub:dispatcher'),
    express    = require('express'),
    bodyParser = require('body-parser'),
    kue        = require('kue'),
    jobs       = kue.createQueue(),
    activity   = require('activity-streams');

function Sockethub(options) {
  this.service   = require('./bootstrap/init.js'); // init routines
  this.platforms = this.service.platforms;

  // initialize express and socket.io objects
  this.app  = express();
  this.http = require('http').Server(this.app);
  console.log(this.service);
  this.io   = require('socket.io')(this.http, { path: this.service.path });
}

Sockethub.prototype.shutdown = function () {

};

Sockethub.prototype.boot = function () {
  var self = this;

  // templating engines
  self.app.set('view engine', 'ejs');

  // use bodyParser
  self.app.use(bodyParser.urlencoded({ extended: true }));
  self.app.use(bodyParser.json());

  // routes
  self.app.get('/', function (req,res) {
    res.render('index.ejs');
  });

  self.app.get('/sockethub-client.js', function (req, res) {
    res.sendFile(path.resolve(__dirname + '/client.js'));
  });

  self.app.get('/activity-streams.js', function (req, res) {
    res.sendFile(path.resolve(__dirname + '/../node_modules/activity-streams/browser/activity-streams.min.js'));
  });

  self.app.get('/examples/irc', function (req, res) {
    res.render('examples/irc.ejs', {
      address: nconf.get('public:protocol') + '://' +
               nconf.get('public:host') + ':' +
               nconf.get('public:port') +
               nconf.get('public:path')
    });
  });

  // websockets
  self.io
      .on('connection', function (socket) {

    debug('a user connected', socket);

    socket.on('disconnect', function () {
      debug('user disconnected');
    });

    socket.on('credentials', function (creds) {
      debug('credentials: ', creds);
      var stream = activity.Stream(creds);
      debug('stream: ', stream);
    });

    socket.on('message', function (msg) {
      debug('message: ', msg);
      self.io.emit('message', msg);
    });

    // when new activity objects are created on the client side, an event is
    // fired and we receive a copy on the server side.
    socket.on('activity-object', function (obj) {
      debug('received activity object from server: ', obj);
      activity.Object.create(obj);
    });

  });

  // start up server
  self.http.listen(self.service.port, self.service.host, function () {
    debug('sockethub listening on ' + self.service.host + ':' + self.service.port);
    debug('active platforms: ', self.platforms.list());
  });
};

module.exports = Sockethub;
