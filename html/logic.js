var noDelay = false; // delay the register command by 2 secs (read register function)
var doPings = false;
var sock;
var rid = 0;
var isRegistered = false;
var sendData = {};
var ridDB = {};
sendData.ping = {
  verb: 'ping',
  platform: 'dispatcher'
};
sendData.register = {
  verb: 'register',
  platform: 'dispatcher',
  object: {
    remoteStorage: {
      storageInfo: '',
      bearerToken: '',
      scope: ''
    },
    secret: '1234567890'
  }
};
sendData.message = {
  "verb" : "message",
  "platform" : "smtp",
  "target" : {
    "to" : [  // at least one record for 'to' required
      {
        "name" : "Michael Jackson",
        "address" : "michael@thejacksonfive.com"
      }
    ],
    "cc" : [
      {
        "name" : "Cindi Lauper",
        "address" : "cindi@girlsjustwannahavefun.biz"
      }
    ],  // ignored if undefined or empty
    "bcc" : []  // ignored if undefined or empty
  },
  "object" : {
    "headers" : {},  // name/value pairs of header data to use
    "subject" : "Hello ...",  // URL encoded string
    "body" : "Is it me you're looking for?",  // URL encoded string
  },
  "actor" : {
    "address" : "Lionel Richie <lionel@dancingontheceiling.com>",
  }
};

var graph = document.getElementById('myCanvas').getContext('2d');
var x = 1;
var graphWidth = document.getElementById('myCanvas').width;
var graphHeight = document.getElementById('myCanvas').height;
var graphScale = graphHeight * .0010;
var graphSpacerWidth = graphWidth * .1
console.log(graphScale, graphHeight);

//console.log('gW: ' + graphWidth + ' gH:' + graphHeight +
//            ' gS:' + graphScale + ' gSpW:' + graphSpacerWidth );
function draw(time, rtt, colour) {
  graph.beginPath();
  graph.moveTo(x, 0);
  graph.lineTo(x, rtt / graphScale); // graphScale = 1s, graphHeight = 10s
  graph.strokeStyle = colour;
  graph.stroke();
  graph.fillStyle = '#eee';
  graph.rect(x, 0, graphSpacerWidth, graphHeight);
  graph.fill();
  x = x + .5;
  x = (x > graphWidth) ? x - graphWidth : x;
}

function connect() {
  var connectString = 'ws://' +
                       document.getElementById('sockethubHost').value +
                       '/sockethub';
  sock = new WebSocket(connectString, 'sockethub');

  sock.onopen = function () {
    setTimeout(function () {
      register();

    }, 0);
    draw(new Date().getTime(), graphHeight, '#0f0');  // green start line
    doPings = true;
  }

  sock.onmessage = function (e) {
    var data = JSON.parse(e.data);
    if (data.status === false) {
      var resp_rid;
      if (typeof data.rid !== 'undefined') {
        resp_rid = data.rid;
      }
      log(3, resp_rid, 'error: '+data.message+' : ' + e.data);
    } else if ((typeof data.response === 'object') &&
               (typeof data.response.timestamp === 'number')) {
      var sentTime = parseInt(data.response.timestamp);
      var now = new Date().getTime();
      var roundTripTime = now - sentTime;
      //log(1, data.rid, 'response received: '+e.data);
      draw(sentTime, roundTripTime, 'black');
    } else if (data.verb === 'register') {
      if (data.status === true) {
        log(2, data.rid, e.data);
        isRegistered = true;
      } else {
        log(3, data.rid, e.data);
      }
    } else if (data.verb === 'confirm') {
      //log(1, data.rid, 'confirmation receipt received. ' + e.data);
    } else {
      log(3, 'unknown data received: ', e.data);
      draw(new Date().getTime(), graphHeight, 'red');
    }
  }

  sock.onclose = function () {
    draw(new Date().getTime(), graphHeight, '#red');
  }
}

function reconnect() {
  doPings = false;
  setTimeout(function () {
    sock.close();
    connect();
  }, 0);
}

window.addEventListener('load', function() {
  setInterval(function () {
    if (doPings) {
      var now = new Date().getTime();
      if(sock.readyState === WebSocket.CONNECTING) {
        draw(now, 10, 'green');
      } else if(sock.readyState === WebSocket.OPEN) {
        if (isRegistered) {
          var sendMsg = sendData.ping;
          sendMsg.rid = getRID('ping');
          sendMsg.timestamp = now;
          var json_sendMsg = JSON.stringify(sendMsg);
          //log(1, sendMsg.rid, json_sendMsg);
          sock.send(json_sendMsg);
          draw(now, 10, 'blue');
        }
      } else if(sock.readyState === WebSocket.CLOSING) {
        draw(now, 10, 'orange');
      } else {  // CLOSED or non-existent
        //console.log('sock.readyState: '+sock.readyState);
        draw(now, 10, 'red');
        connect();
      }
    }
  }, 1000);
});

function togglePings() {
  doPings = (doPings) ? false : true;
}

function log(type, rid, message) {
  var c = { 1:'blue', 2:'green', 3:'red'};
  var d = new Date();
  var ds = (d.getHours() + 1) + ':' + d.getMinutes() + ':' + d.getSeconds();
  var verb;
  var prefix;
  if (rid) {
    verb = lookupVerb(rid);
    prefix = ds + ' ['+verb+']';
  } else {
    prefix = ds + ' []';
  }
  var p = document.createElement('p');
  p.style.color = c[type];
  var pmsg = document.createTextNode(prefix + ' - ' + message +"\n");
  p.appendChild(pmsg);
  var line = document.createTextNode();
  var pre = document.getElementById('log');
  pre.insertBefore(p, pre.childNodes[0]);
}

/** REMOTESTORAGE STUFF **/

function initRemoteStorage() {

  remoteStorage.defineModule('sockethub', function(privClient, pubClient) {
    return {
      exports: {}
    };
  });

  remoteStorage.claimAccess('sockethub', 'rw').then(function() {
    remoteStorage.displayWidget('remotestorage-connect');
  });
}

function register(noDelay) {
  var register = sendData.register;
  setTimeout(function() {
    register.object.remoteStorage.storageInfo = remoteStorage.getStorageInfo();
    register.object.remoteStorage.bearerToken = remoteStorage.getBearerToken()
    register.object.remoteStorage.scope = remoteStorage.claimedModules;
    if(! register.object.remoteStorage.bearerToken) {
      log(3, null, "You need to connect to your storage first!");
    } else {
      register.rid = getRID('register');
      var rawMessage = JSON.stringify(register);
      log(1, register.rid, rawMessage);
      sock.send(rawMessage);
    }
  }, (noDelay) ? 0 : 2000); // we delay 2 secs because when we come back from the
            // authorization sometimes the remoteStorage object is not
            // populated right away.
}

function getRID(verb) {
  rid++;
  ridDB[rid] = verb;
  delete ridDB[rid - 20];
  return rid;
}

function lookupVerb(rid) {
  var v = '';
  if (typeof ridDB[rid] !== 'undefined') {
    v =  ridDB[rid];
  }
  return v;
}

window.addEventListener('load', initRemoteStorage);
window.addEventListener('load', connect);

