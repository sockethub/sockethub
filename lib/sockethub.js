/* global __dirname */
const nconf      = require('nconf'),
      path       = require('path'),
      randToken  = require('rand-token'),
      Debug      = require('debug'),
      express    = require('express'),
      bodyParser = require('body-parser'),
      kue        = require('kue'),
      dsCrypt    = require('dead-simple-crypt'),
      Store      = require('secure-store-redis'),
      activity   = require('activity-streams')(nconf.get('activity-streams:opts'));

const Worker      = require('./worker.js'),
      middleware  = require('./middleware.js'),
      init        = require('./bootstrap/init.js'),
      Validate    = require('./validate.js'),
      SR          = require('./shared-resources.js');

const debug        = Debug('sockethub:core'),
      rmdebug      = Debug('sockethub:resource-manager'),
      parentId     = randToken.generate(16),
      parentSecret = randToken.generate(64);

let redisCfg = nconf.get('redis');
if (redisCfg.url) {
  redisCfg = redisCfg.url;
}

const queue = kue.createQueue({
  prefix: 'sockethub:' + parentId + ':queue',
  redis: redisCfg
});

function Sockethub() {
  this.counter   = 0;
  this.platforms = init.platforms;

  // initialize express and socket.io objects
  this.app   = express();
  this.http  = require('http').Server(this.app);
  this.io    = require('socket.io')(this.http, { path: init.path });
  this.status = false;

  debug('sockethub session id: ' + parentId);
}


Sockethub.prototype.shutdown = function () {};


Sockethub.prototype.boot = function () {
  if (this.status) {
    return debug('Sockethub.boot() called more than once');
  } else { this.status = true; }
  debug('redis connection info ', nconf.get('redis'));

  // templating engines
  this.app.set('view engine', 'ejs');

  // use bodyParser
  this.app.use(bodyParser.urlencoded({ extended: true }));
  this.app.use(bodyParser.json());

  // routes list
  [
    'base',
    'examples'
  ].map((routeName) => {
    const route = require( path.join(__dirname, '/../', 'routes', routeName) );
    return route.setup(this.app);
  });

  resourceManagerCyle();
  debug('registering handlers');
  this.__registerJobHandlers();
  this.__registerClientHandlers();
  this.__startServices();
};

// handle job results, from workers, in the queue
//
Sockethub.prototype.__processJobResult = function (type) {
  return (id, result) => {
    kue.Job.get(id, (err, job) => {
      if (err) {
        debug(`error retreiving (${type}) job #${id}`);
        return;
      }

      if (this.io.sockets.connected[job.data.socket]) {
        job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, parentSecret));

        if (result) {
          if (type === 'completed') {
            job.data.msg.message = result;
          } else if (type === 'failed') {
            job.data.msg.error = result;
          }
        }

        debug(`job ${job.id} on socket ${job.data.socket} completed`);
        this.io.sockets.connected[job.data.socket].emit(type, job.data.msg);
      } else {
        debug(`received (${type}) job for non-existent socket ${job.data.socket}`);
      }

      job.remove((err) => {
        if (err) {
          debug(`error removing (${type}) job #${job.id}, ${err}`);
        }
      });
    });
  };
};

Sockethub.prototype.__registerJobHandlers = function () {
  queue.on('job complete', this.__processJobResult('completed'));
  queue.on('job failed', this.__processJobResult('failed'));
};

// handlers from client messages
//
Sockethub.prototype.__registerClientHandlers = function () {
  this.io.on('connection', (socket) => {
    const sdebug = Debug('sockethub:core:' + socket.id),
          workerSecret = randToken.generate(16);
    sdebug('connected to socket.io channel ' + socket.id);
    SR.socketConnections.set(socket.id, socket);

    const worker = new Worker({
      parentId: parentId,
      parentSecret: parentSecret,
      workerSecret: workerSecret,
      socket: socket,
      platforms: Array.from(this.platforms.keys())
    });
    worker.boot();

    const validate = Validate({
      onfail: (err, type, msg) => {
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

    // store interfaces are session specific
    const store = new Store({
      namespace: 'sockethub:' + parentId + ':worker:' + socket.id + ':store',
      secret: parentSecret + workerSecret,
      redis: nconf.get('redis')
    });

    // handlers
    socket.on('disconnect', () => {
      sdebug('disconnect received from client.');
      worker.shutdown();
      delete SR.socketConnections.delete(socket.id);
    });

    socket.on('credentials', middleware(validate('credentials'), (creds) => {
      store.save(creds.actor['@id'], creds, (err, reply) => {
        if (err) {
          sdebug('error saving credentials to store ' + err);
        } else {
          sdebug('credentials encrypted and saved with key: ' + creds.actor['@id']);
        }
      });
    }));

    socket.on('message', middleware(validate('message'), (msg) => {
      sdebug('queueing incoming job for ' + msg.context);
      const job = queue.create(socket.id, {
        title: socket.id + '-' + msg.context + '-' + (msg['@id']) ? msg['@id'] : counter++,
        socket: socket.id,
        msg: dsCrypt.encrypt(JSON.stringify(msg), parentSecret)
      }).save((err) => {
        if (err) {
          sdebug('error adding job [' + job.id + '] to queue: ', err);
        }
      });
    }));

    // when new activity objects are created on the client side, an event is
    // fired and we receive a copy on the server side.
    socket.on('activity-object', middleware(validate('activity-object'), (obj) => {
      sdebug('processing activity-object');
      activity.Object.create(obj);
    }));
  });
};


// start up services
//
Sockethub.prototype.__startServices = function () {
  if (nconf.get('kue:enabled')) {
    // start kue UI
    kue.app.listen(nconf.get('kue:port'), nconf.get('kue:host'), () => {
      debug('service queue interface listening on ' + nconf.get('kue:host') + ':'
        + nconf.get('kue:port'));
    });
  }

  // start socket.io
  this.http.listen(init.port, init.host, () => {
    debug('sockethub listening on http://' + init.host + ':' + init.port);
    debug('active platforms: ', [...init.platforms.keys()]);
  });
};



//////
// resource manager
//
function resourceManagerCyle() {
  rmdebug('initializing resource manager');
  let reportCount = 0;
  setInterval(() => {
    reportCount++;
    if (reportCount === 4) {
      rmdebug('sockets: ' + SR.socketConnections.size +
        ' instances: ' + SR.platformInstances.size);
      reportCount = 0;
    }

    for (let platformInstance of SR.platformInstances.values()) {
      for (let socketId of platformInstance.sockets.values()) {
        if (!SR.socketConnections.has(socketId)) {
          rmdebug('removing stale socket reference ' + socketId + ' in platform instance '
            + platformInstance.id);
          platformInstance.sockets.delete(socketId);
        }
      }

      if (platformInstance.sockets.size <= 0) {
        if (platformInstance.flaggedForTermination) {
          // terminate
          rmdebug(`terminating platform instance ${platformInstance.id} ` +
            `(flagged for termination: no registered sockets found)`);
          try {
            platformInstance.module.cleanup(() => {
              SR.platformMappings.delete(platformInstance.actor['@id']);
              SR.platformInstances.delete(platformInstance.id);
            });
          } catch (e) {
            SR.platformMappings.delete(platformInstance.actor['@id']);
            SR.platformInstances.delete(platformInstance.id);
          }
        } else {
          rmdebug(`flagging for termination platform instance ${platformInstance.id} ` +
            `(no registered sockets found)`);
          platformInstance.flaggedForTermination = true;
        }
      } else {
        platformInstance.flaggedForTermination = false;
      }
    }
  }, 15000);
}


module.exports = Sockethub;