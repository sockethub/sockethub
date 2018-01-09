/* global __dirname */
var nconf      = require('nconf'),
    path       = require('path'),
    randToken  = require('rand-token'),
    Debug      = require('debug'),
    express    = require('express'),
    bodyParser = require('body-parser'),
    kue        = require('kue'),
    dsCrypt    = require('dead-simple-crypt'),
    Store      = require('secure-store-redis'),
    activity   = require('activity-streams')(nconf.get('activity-streams:opts'));


var Worker     = require('./worker.js'),
    middleware = require('./middleware.js'),
    init       = require('./bootstrap/init.js'),
    Validate   = require('./validate.js');


var debug       = Debug('sockethub:core'),
    sockethubID = randToken.generate(16),
    secret      = randToken.generate(64);

var redisCfg = nconf.get('redis');
if (redisCfg.url) {
  redisCfg = redisCfg.url
}
var queue = kue.createQueue({
  prefix: 'sockethub:' + sockethubID + ':queue',
  redis: redisCfg
});

function Sockethub(options) {
  this.counter   = 0;
  this.platforms = init.platforms;

  // initialize express and socket.io objects
  this.app   = express();
  this.http  = require('http').Server(this.app);
  this.io    = require('socket.io')(this.http, { path: init.path });

  debug('sockethub session id: ' + sockethubID);
}


Sockethub.prototype.shutdown = function () {};


Sockethub.prototype.boot = function () {
  var self = this;

  debug('registering handlers');
  debug("redis connection info ", nconf.get('redis'));

  // templating engines
  self.app.set('view engine', 'ejs');

  // use bodyParser
  self.app.use(bodyParser.urlencoded({ extended: true }));
  self.app.use(bodyParser.json());

  // routes list
  [
    'base',
    'examples'
  ].map(function (routeName) {
    var route;
    route = require( path.join(__dirname, '/../', 'routes', routeName) );
    return route.setup(self.app);
  });

  //
  // handle job results
  //
  queue.on('job complete', function (id, result) {
    kue.Job.get(id, function (err, job) {
      if (err) {
        debug('failed retreiving job #' + id);
        return;
      }

      if (self.io.sockets.connected[job.data.socket]) {
        job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, secret));

        if (result) {
          job.data.msg.message = result;
        }

        debug(job.data.socket + ': job [' + job.id + '] completed.');
        self.io.sockets.connected[job.data.socket].emit('completed', job.data.msg);
      } else {
        debug('received completed job for non-existent socket');
      }

      job.remove(function (err) {
        if (err) {
          throw err;
        }
      });
    });
  });

  queue.on('job failed', function (id, errorMessage) {
    debug('failed job: ' + id, errorMessage);
    kue.Job.get(id, function (err, job) {
      if (err) {
        debug('failed retreiving job #' + id);
        return;
      }

      debug('job [' + job.id + '] failed for socket ' + job.data.socket);
      if (self.io.sockets.connected[job.data.socket]) {
        job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, secret));
        job.data.msg.error = errorMessage;
        self.io.sockets.connected[job.data.socket].emit('failure', job.data.msg);
      }

      job.remove(function (err) {
        if (err) {
          throw err;
        }
        debug('removed failed job #%d', job.id);
      });
    });
  });

  //
  // incoming handlers
  //
  self.io.on('connection', function (socket) {
    var sdebug = Debug('sockethub:core:' + socket.id);
    sdebug('connected to socket.io channel ' + socket.id);

    var validate = Validate({
      onfail: function (err, type, msg) {
        sdebug('validation failed for ' + type + '. ' + err);
        // called with validation fails
        if (typeof msg !== 'object') {
          msg = {};
        }
        msg.error = err;

        // send failure
        socket.emit('failure', msg);
      }
    });

    //
    // instantiate session worker to process from the kue
    //
    var worker = new Worker({
      id: sockethubID,
      socket: socket,
      secret: secret,
      platforms: self.platforms.getIdentifiers()
    });
    worker.boot();

    // store interfaces are session specific, extend secret to include socket ID
    var store = new Store({
      namespace: 'sockethub:' + sockethubID + ':store',
      secret: secret + socket.id,
      redis: nconf.get('redis')
    });

    // handlers
    socket.on('disconnect', function () {
      sdebug('disconnected.');

      self.platforms.forEachRecord(function (platform) {
        sdebug('creating cleanup job for ' + platform.id);
        queue.create(socket.id, {
          title: socket.id + '-' + platform.id + '-cleanup',
          socket: socket.id,
          msg: dsCrypt.encrypt(JSON.stringify({
            context:  platform.id,
            '@type': 'cleanup'
          }), secret)
        }).save(function (err, job) {
          // console.log('DEBUG: ', err, job);
          if (err) {
            sdebug('error adding job to queue: ', err);
          }
        });
      });
    });

    socket.on('credentials', middleware(validate('credentials'), function (creds) {
      sdebug('processing credentials');
      store.save(creds.context, creds.actor['@id'], creds, function (err, reply) {
        sdebug('credentials encrypted and saved to ' + creds.actor['@id']);
      });
    }));

    socket.on('message', middleware(validate('message'), function (msg) {
      sdebug('processing incoming message ', msg);
      var job = queue.create(socket.id, {
        title: socket.id + '-' + msg.context + '-' + (msg['@id']) ? msg['@id'] : counter++,
        socket: socket.id,
        msg: dsCrypt.encrypt(JSON.stringify(msg), secret)
      }).save(function (err) {
        if (err) {
          sdebug('error adding job [' + job.id + '] to queue: ', err);
        }
      });
    }));

    // when new activity objects are created on the client side, an event is
    // fired and we receive a copy on the server side.
    socket.on('activity-object', middleware(validate('activity-object'), function (obj) {
      sdebug('processing activity-object');
      activity.Object.create(obj);
    }));
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
  self.http.listen(init.port, init.host, function () {
    debug('sockethub listening on http://' + init.host + ':' + init.port);
    debug('active platforms: ', init.platforms.getIdentifiers());
  });
};


module.exports = Sockethub;