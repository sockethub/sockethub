var domain = require('domain');
var cluster = require('cluster');

var h;
var server;
module.exports = {
  init: function (config) {
    var fs = require('fs');
    var node_static = require('node-static');
    var h;
    var serverCfg = {};

    // static files server
    var static_directory = new node_static.Server((config.EXAMPLES.LOCATION) ? config.EXAMPLES.LOCATION : './examples');

    // http listeners
    function listeners(req, res) {

      var dom = domain.create();

      dom.on('error', function(error) {
        // FIXME: for some reason this never gets called. We may need to
        //   do something else to make sure all platforms really run in
        //   this domain. Not sure what.

        try {
          console.error("Worker " + cluster.worker.id + " generated error: ", error.stack);

          // make sure we exit after (at most) 10 seconds
          setTimeout(process.exit, 10000, 1).unref();
          // close server, so no new connections are accepted
          server.close();
          // inform master process that we're dead
          cluster.worker.disconnect();
        } catch(exc) {
          console.error("Worker failed to die: ", exc.stack);
          process.exit(2);
        }
      });

      dom.add(req);
      dom.add(res);

      console.info(' [http] connect - ' + req.url);

      dom.run(function() {
        /*
          req.addListener('request', function(req, res) {
          console.log('[http] request - ' + req.url);
          static_directory.serve(req, res);
          });
        */

        req.addListener('upgrade', function(req,res){
          console.info(' [http] upgrade - ' + req.url);
          res.end();
        });

        req.addListener('end', function () {
          console.info(' [http] end - ' + req.url);
          if ((config.PUBLIC) && (config.PUBLIC.PATH)) {
            if (req.url.substr(0, config.PUBLIC.PATH.length) === config.PUBLIC.PATH) {
              console.debug(' [http] [public path] stripping '+config.PUBLIC.PATH+' from '+req.url);
              req.url = req.url.replace(config.PUBLIC.PATH+'/', '/');
            }
          }

          if (req.url.substr(0, config.PUBLIC.EXAMPLES_PATH.length) === config.PUBLIC.EXAMPLES_PATH) {
            console.debug(' [http] [examples path] stripping '+config.PUBLIC.EXAMPLES_PATH+' from '+req.url);
            req.url = req.url.replace(config.PUBLIC.EXAMPLES_PATH, '');

            console.debug(' [http] serving ' + req.url);
            static_directory.serve(req, res);
          } else {
            res.writeHead('404');
            res.end();
          }
        }).resume();

      });
    }


    // initiallize http or https server
    if (config.HOST.ENABLE_TLS) {
      h = require('https');
      serverCfg = {
        key: fs.readFileSync(config.HOST.TLS_DIR + '/tls.key'),
        cert: fs.readFileSync(config.HOST.TLS_DIR + '/tls.cert'),
        ca: fs.readFileSync(config.HOST.TLS_DIR + '/ca.pem')
      };
      server = h.createServer(serverCfg, listeners);
    } else {
      h = require('http');
      server = h.createServer(listeners);
    }


    // start http server
    server.listen(config.HOST.PORT, function () {
      console.info(' [http] server is listening on port ' + config.HOST.PORT);
    });
    return server;
  },
  close: function () {
    server.close();
  }
};
