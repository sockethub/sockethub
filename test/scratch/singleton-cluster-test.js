var cluster = require('cluster');
var NUM_WORKERS = 3;
var i = 0;

var number = require('./singleton-test-1.js')('word');



if (cluster.isMaster) {
  /** MASTER **/


  for (i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('disconnect', function (worker) {
    console.error(" worker " + worker.id +
                  " disconnected, spawning new one.");
    cluster.fork();
  });

  cluster.on('exit', function (worker, code, signal) {
    if (code === 1) {
      console.log(' worker exited ' + code +
                   ' ... shutting down');
    }
    if (worker.suicide) {
      console.log(' worker exited '+code+' '+signal);
    }
  });


} else if (cluster.isWorker) {
  /** WORKER **/


  var me = []; // running worker instance

  process.on('uncaughtException', function (err) {
    console.log(' caught exception: ' + err, err);
    if (err.stack) {
      console.log(err.stack);
    }
    process.exit();
  });

  process.on('SIGINT', function () {
    console.log(" worker: caught SIGINT (Ctrl+C)");
    //console.log(' ending worker session. me');
    //for (var i = 0, len = workers.length; i < len; i = i + 1) {
    //  me.shutdown();
    //}
    process.exit();
  });
  process.on('SIGTERM', function () {
    console.log("\n [listener-control] caught SIGTERM");
  });

  for (i = 1; i < 5; i = i + 1) {
    console.log('loading single-test-'+i+'.js  with singleton object: ', number);
    try {
      me[i] = require('./singleton-worker.js')(i, number);
    } catch (e) {
      console.error(' failed initializing ' + i + ' platform: ', e);
      process.exit(1);
    }
  }

  cluster.worker.on('message', function (message) {
    console.log('WORKER message: ', message);
  });
}
