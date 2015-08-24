/**
 * Function: HttpServer
 *
 * The HttpServer object is used to create a very basic HTTP Server, used mainly
 * for assisting jaribu in verifying the functionality of it's http-suite.js
 *
 *      env.expected = { // struct of expected results for each http call
 *         test: {
 *            foo: "bar"
 *          }
 *      };
 *
 *      env.server = new this.HttpServer({
 *          port: 9991,
 *          uris: env.expected
 *      });
 *      this.assertAnd(env.server.run(), true);
 *
 * Parameters:
 *
 *   object conatining the properties:
 *       port - port to run on
 *
 *       uris - an object where the first set of properties are URIs the values
 *              attached to them are the data sets to return.
 *
 * Returns:
 *
 *   returns output from the function passed as parameter
 */
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function (undefined) {

  var HttpServer = function (cfg) {
    if (typeof cfg.port === 'number') {
      this.port = cfg.port;
    }
    if (typeof cfg.uris === 'object') {
      this.uris = cfg.uris;
    }
  };

  HttpServer.prototype = {
    port: 9500,
    uris: {},
    http: undefined
  };

  HttpServer.prototype.run = function (callback) {
    var key;
    var express    = requirejs('express');
    var bodyParser = requirejs('body-parser');

    this.http = requirejs('http');
    var app   = express();

    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    var _this = this;
    function __addRoutes(key) {
      app.get('/' + key, function (req, res) {
        console.log('GET CALLED ['+key+']: ');
        res.json(_this.uris[key]);
      });
      app.post('/' + key, function (req, res) {
        console.log('POST CALLED ['+key+']: ', req.body);
        _this.uris[key] = req.body;
        res.json('POST /' + key);
      });
      app.delete('/' + key, function (req, res) {
        _this.uris[key] = req.body;
        res.json('DEL /' + key);
      });
      app.put('/' + key, function (req, res) {
        _this.uris[key] = req.body;
        res.json('PUT /' + key);
      });
    }

    for (key in this.uris) {
      __addRoutes(key);
    }

    app.get('/', function (req, res) {
      res.json({ name: "jaribu" });
    });

    this.server = this.http.createServer(app);
    this.server.listen(this.port, '127.0.0.1', function () {
      console.log('listening at: ', _this.server.address());
      callback();
    });
  };

  HttpServer.prototype.stop = function () {
    this.server.close();
  };

  return HttpServer;
});


