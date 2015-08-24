/**
 * Module dependencies.
 */
var express = require('express'),
    config = require('./config.js'),
    http = require('http'),
    path = require('path');

    app = express();
    port = config.port || 8080;

app.configure(function () {
  app.set('port', process.env.PORT || port);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function () {
  app.use(express.errorHandler());
});

app.get('/', function (req, res) {
  teste = require('./teste.js');
  res.send("teste is running", teste);
});

http.createServer(app).listen(app.get('port'), function () {
  console.log("Express server listening on port " + app.get('port'));
});
