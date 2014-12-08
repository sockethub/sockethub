var domain     = require('domain'),
    path       = require('path'),
    express    = require('express'),
    nconf      = require('nconf'),
    bodyParser = require('body-parser'),
    Activity   = require('activity-streams');

// assign config loading priorities (command-line, environment, cfg, defaults)
nconf.argv()
     .env()
     .file({ file: __dirname + '/../config.json' })
     .file({ file: __dirname + '/defaults.json' });

// load relevant config objects
var service   = {
  host: nconf.get('HOST'),
  port: +nconf.get('PORT')
};
var debug     = nconf.get('DEBUG');      // TODO
var genConfig = nconf.get('GEN-CONFIG'); // TODO

// initialize express and socket.io objects
var app       = express(),
    http      = require('http').Server(app),
    io        = require('socket.io')(http, { path: '/sockethub' });

// templating engines
app.set('view engine', 'ejs');

// use bodyParser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// routes
app.get('/', function (req,res) {
  res.render('index.ejs');
});

app.get('/sockethub-client.js', function (req, res) {
  res.sendFile(path.resolve(__dirname + '/client.js'));
});

app.get('/activity-streams.js', function (req, res) {
  res.sendFile(path.resolve(__dirname + '/../node_modules/activity-streams/browser/activity-streams.min.js'));
});


app.get('/examples/irc', function (req, res) {
  res.render('examples/irc.ejs', {
    address: nconf.get('PUBLIC:PROTOCOL') + '://' +
             nconf.get('PUBLIC:HOST') + ':' +
             nconf.get('PUBLIC:PORT') +
             nconf.get('PUBLIC:PATH')
  });
});

// websockets
io.on('connection', function (socket) {
  console.log('a user connected');

  socket.on('disconnect', function () {
    console.log('user disconnected');
  });

  socket.on('message', function (msg) {
    console.log('message: ', msg);
    var stream = Activity.Stream(msg);
    console.log('stream: ', stream);
    io.emit('message', msg);
  });

  socket.on('activity-object', function (obj) {
    console.log('received activity object from server: ', obj);
    Activity.Object.create(obj);
  });
});

// start up server
http.listen(service.port, service.host, function () {
  console.log('sockethub listening on ' + service.host + ':' + service.port);
});
