var nconf      = require('nconf'),
    path       = require('path'),
    assert     = require('assert'),
    randToken  = require('rand-token'),
    Debug      = require('debug'),
    express    = require('express'),
    bodyParser = require('body-parser'),
    kue        = require('kue'),
    dsCrypt    = require('dead-simple-crypt'),
    Worker     = require('./worker.js'),
    activity   = require('activity-streams');

var debug = Debug('sockethub:dispatcher');

function Sockethub(options) {
  this.counter   = 0;
  this.service   = require('./bootstrap/init.js'); // init routines
  this.platforms = this.service.platforms;
  this.id        = randToken.generate(16);
  this.secret    = randToken.generate(64);

  // initialize express and socket.io objects
  this.app  = express();
  this.http = require('http').Server(this.app);
  this.io   = require('socket.io')(this.http, { path: this.service.path });
  this.jobs = kue.createQueue({
    prefix: 'sockethub:' + this.id + ':queue',
    redis: nconf.get('redis')
  });

  debug('sockethub session id: ' + this.id);
}


Sockethub.prototype.shutdown = function () {};


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

  //
  // handle job results
  //
  self.jobs.on('job complete', function (id, result) {
    kue.Job.get(id, function (err, job) {
      if (err) {
        debug('failed retreiving job #' + id);
        return;
      }

      debug(job.socket + ': job [' + job.id + '] completed with data ', result);
      self.io.sockets.socket(job.socket).emit(result);

      job.remove(function (err) {
        if (err) {
          throw err;
        }
        debug('removed completed job #%d', job.id);
      });
    });
  });

  self.jobs.on('job failed', function (id) {
    kue.Job.get(id, function (err, job) {
      if (err) {
        debug('failed retreiving job #' + id);
        return;
      }

      debug(job.socket + ': job [' + job.id + '] failed');
      job.msg.result = false;
      self.io.sockets.socket(job.socket).emit(job.msg);

      job.remove(function (err) {
        if (err) {
          throw err;
        }
        debug('removed completed job #%d', job.id);
      });
    });
  });

  //
  // incoming handlers
  //
  self.io
      .on('connection', function (socket) {
    sdebug = Debug('sockethub:dispatcher:' + socket.id);

    sdebug('connected');

    socket.on('disconnect', function () {
      sdebug('disconnected');
    });

    socket.on('credentials', function (creds) {
      sdebug('received credentials');
      // var stream = activity.Stream(creds);
      // debug('stream: ', stream);
    });

    socket.on('message', function (msg) {
      sdebug('message received ', msg);

      var job = self.jobs.create('irc', {
        title: socket.id + '-' + (msg.id) ? msg.id : counter++,
        socket: socket.id,
        msg: dsCrypt.encrypt(JSON.stringify(msg), self.secret)
      }).save(function (err) {
        if (err) {
          sdebug('error adding job [' + job.id + '] to queue: ', err);
        } else {
          sdebug('job [' + job.id + '] added to queue.');
        }
      });

    });

    // when new activity objects are created on the client side, an event is
    // fired and we receive a copy on the server side.
    socket.on('activity-object', function (obj) {
      sdebug('received activity object from server: ', obj);
      activity.Object.create(obj);
    });

  });

  //
  // load platform workers to process from the kue
  //
  self.platforms.forEachRecord(function (platform) {
    var worker = new Worker({
      id: self.id,
      secret: self.secret,
      platform: platform
    });
    worker.boot();
  });

  //
  // start up services
  //
  if (nconf.get('kue:enabled')) {
    // start kue UI
    kue.app.listen(nconf.get('kue:port'), nconf.get('kue:host'), function () {
      debug('service queue interface listening on ' + nconf.get('kue:host') + ':' + nconf.get('kue:port'));
    });
  }

  // start socket.io
  self.http.listen(self.service.port, self.service.host, function () {
    debug('sockethub listening on ' + self.service.host + ':' + self.service.port);
    debug('active platforms: ', self.platforms.getIdentifiers());
  });
};


module.exports = Sockethub;
