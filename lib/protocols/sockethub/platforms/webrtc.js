var sockjs = require('sockjs');

var httpServer = require('http').createServer(function (request, response) {
  response.writeHead(200);
  response,end('please connect a websocket');
});

var userSays = function() {
  console.log('user talks to a brick wall');
};
var friendSays = function() {
  console.log('friend talks to a brick wall');
};

module.exports = {
  send: function(job, session) {
    userSays(job.object);
  },
  join: function(job, session) {
    friendSays = function(chunk) {
      console.log('friend says', chunk);
      session.send(chunk);
    };
  }  
};

friendServer = sockjs.createServer();
friendServer.on('connection', function(conn) {
  console.log('friend connected');
  conn.on('data', function(chunk) {
    friendSays(chunk);
  });
  userSays = function(chunk) {
    console.log('user says', chunk);
    conn.write(chunk);
  };
});
friendServer.installHandlers(httpServer, { prefix: '/friend-sock' });
httpServer.listen(8080);//TODO: get this port number from the config

// //set up stun server using https://github.com/enobufs/stun:
// var stun = require('../../../vendor/stun').createServer();
// stun.setAddress0(settings.STUN_SERVER_ADDR_0);
// stun.setAddress1(settings.STUN_SERVER_ADDR_1);
// stun.listen();
