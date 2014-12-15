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
  this.counter   = 0;
  this.service   = require('./bootstrap/init.js'); // init routines
  this.platforms = this.service.platforms;

  // initialize express and socket.io objects
  this.app  = express();
  this.http = require('http').Server(this.app);
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

  // listen for all job results
  jobs.on('job complete', function (id, result) {
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

  jobs.on('job failed', function (id) {
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

  // websockets
  self.io
      .on('connection', function (socket) {

    debug('a user connected', socket.id);

    socket.on('disconnect', function () {
      debug('user disconnected');
    });

    socket.on('credentials', function (creds) {
      debug('credentials: ', creds);
      var stream = activity.Stream(creds);
      debug('stream: ', stream);
    });

    socket.on('message', function (msg) {
      debug(socket.id + ': message: ', msg);

      var job = jobs.create('irc', {
        title: socket.id + '-' + (msg.id) ? msg.id : counter++,
        socket: socket.id,
        msg: msg
      }).save(function (err) {
        if (err) {
          debug('error adding job [' + job.id + '] to queue: ', err);
        } else {
          debug('job [' + job.id + '] added to queue.');
        }
      });

    });

    // when new activity objects are created on the client side, an event is
    // fired and we receive a copy on the server side.
    socket.on('activity-object', function (obj) {
      debug('received activity object from server: ', obj);
      activity.Object.create(obj);
    });

  });


  if (nconf.get('kue:enabled')) {
    // start kue UI
    kue.app.listen(nconf.get('kue:port'), nconf.get('kue:host'), function () {
      debug('service queue interface listening on ' + nconf.get('kue:host') + ':' + nconf.get('kue:port'));
    });
  }

  // start up server
  self.http.listen(self.service.port, self.service.host, function () {
    debug('sockethub listening on ' + self.service.host + ':' + self.service.port);
    debug('active platforms: ', self.platforms.list());
  });
};

module.exports = Sockethub;
