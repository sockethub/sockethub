/**
 * This file is part of sockethub.
 *
 * © 2012-2013 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the AGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of sockethub can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */


var config = require('./../sockethub/config-loader.js');
var path = require('path');
var node_static = require('node-static');
var fs = require('fs');
module.exports = {
  init: function (config) {
    var h;
    var server;
    var serverCfg = {};

    // static files server
    var examples = new node_static.Server(config.EXAMPLES.DIRECTORY);

    //
    // http listeners
    function listeners(req, res) {
      //console.debug(' [http] connect - ' + req.url);

      req.addListener('upgrade', function(req,res){
        console.info(' [http] upgrade - ' + req.url);
        res.end();
      });

      req.addListener('end', function () {
        console.info(' [http] request - ' + req.url);
        if ((config.PUBLIC) && (config.PUBLIC.WEBSOCKET_PATH)) {
          if (req.url.substr(0, config.PUBLIC.WEBSOCKET_PATH.length) === config.PUBLIC.WEBSOCKET_PATH) {
            //console.debug(' [http] [public path] stripping ' +
            //                 config.PUBLIC.WEBSOCKET_PATH + ' from ' + req.url);
            req.url = path.normalize(req.url.replace(config.PUBLIC.WEBSOCKET_PATH + '/', '/'));
          }
        }

        if ((config.EXAMPLES.ENABLE) &&
            (req.url.substr(0, config.PUBLIC.EXAMPLES_PATH.length) === config.PUBLIC.EXAMPLES_PATH)) {
          // console.debug(' [http] [examples path] stripping ' +
          //                  config.PUBLIC.EXAMPLES_PATH + ' from ' + req.url);
          req.url = path.normalize(req.url.replace(config.PUBLIC.EXAMPLES_PATH, '/'));

          //console.debug(' [http] serving ' + config.EXAMPLES.DIRECTORY + req.url);
          examples.serve(req, res, function (e, r) {
            if (e && (e.status === 404)) { // If the file wasn't found
              //fileServer.serveFile('/not-found.html', 404, {}, request, response);
              console.warn(' [http] response ' + e.status + ' on - ' + req.url);
              res.writeHead(e.status, e.headers);
              res.end();
            }
          });
        } else {
          console.warn(' [http] response 403 on (no match) - ' + req.url);
          res.writeHead('403');
          res.end();
        }
      }).resume();
    }

    //
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

    //
    // start http server
    console.debug(' [http] attempting to listen on port '+ config.HOST.PORT);
    server.listen(config.HOST.PORT, function () {
      //console.log(typeof console.always);
      console.debug(' [http] server is listening on port ' + config.HOST.PORT);
    });

    return server;
  },
  close: function () {
    try {
      server.close();
    } catch (e) {
      throw new Error(e);
    }
  }
};
