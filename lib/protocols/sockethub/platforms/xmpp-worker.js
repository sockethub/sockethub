var promising = require('promising');
var assert = require('assert');
if (typeof(xmpp) !== 'object') {
  xmpp = require('simple-xmpp');
}


var sessionId = '';
var idCounter = 0;
var client = '';

function nextId() {
  return ++idCounter;
}

function jidStripResource(jid) {
  return jid.split('/')[0];
}

function isLoggedIn() {
  if (!isLoggedIn) {
    throw "worker not logged in";
  }
}

function initClient(actor, credentials) {
  console.log('initClient called');
  var promise = promising();

  if (typeof credentials[actor] === 'undefined') {
    promise.reject('unable to get credentials for ' + actor);
    return;
  }

  var creds = credentials[actor];
  var bareJid = creds.username;
  var fullJid = bareJid + '/' + creds.resource;

  console.log('fullJid: '+fullJid);
  var account = {
    jid: fullJid,
    password: creds.password,
    host: creds.server,
    port: (creds.port) ? creds.port : 5222
  };


  xmpp.on('stanza', function (stanza) {
    console.log("got XMPP stanza: " + stanza);
  });

  xmpp.on('error', function (error) {
    console.log("got XMPP error: " + error);

    if (typeof client === 'object') {
      try {
        console.log('rejecting promise onerror');
        promise.reject("Failed to create XMPP client: " + error);
      } catch (e) {
        console.log('failed rejecting promise on error');
      }
    }
  });

  xmpp.on('chat', function (from, message) {
    console.log("received chat message from "+from);
    postMessage({
      send: {
        verb: 'send',
        actor: { address: from },
        target: [{ address: actor }],
        object: {
          text: message,
          id: _.nextId()
        }
      }
    });
  });

  xmpp.on('buddy', function (from, state, statusText) {
    if (from !== actor) {
      console.log('received buddy state update: ' + from + ' - ' + state);
      postMessage({
        send: {
          verb: 'update',
          actor: { address: from },
          target: [{ address: actor }],
          object: {
            statusText: statusText,
            state: state
          }
        }
      });
    }
  });

  xmpp.on('subscribe', function (from) {
    console.log('received subscribe request from '+from);
    postMessage({
      send: {
        verb: "request-friend",
        actor: { address: from },
        target: [{address: actor}]
      }
    });
  });

  xmpp.on('unsubscribe', function (from) {
    console.log('received unsubscribe request from '+from);
    postMessage({
      send: {
        verb: "remove-friend",
        actor: { address: from },
        target: [{address: actor}]
      }
    });
  });

  xmpp.on('online', function() {
    console.log('online now with jid: ' + fullJid);
    client = xmpp;

    xmpp.getRoster();
    console.log('requested XMPP roster');
    promise.fulfill();
  });

  xmpp.connect(account);
  console.log('sent XMPP connect');
  return promise;
}


function login(sId, actor, creds) {
  var promise = promising();
  sessionId = sId;
  if (!isLoggedIn) {
    initClient(actor, creds).then(function () {
      isLoggedIn = true;
      promise.fulfill();
    }, function (err) {
      promise.reject(err);
    });
  } else {
    promise.reject('client already logged in');
  }
  return promise;
}

function logout() {
  var promise = promising();
  try {
    client.end();
  } catch (e) {
    console.log("unabled to end xmpp connection for client "+jid+":", e); //deleting reference anyway.",e);
  }
  setTimeout(function () {
    client = '';
    promise.fulfill();
  }, 1000);
  return promise;
}

function send(job) {
  var promise = promising();
  isLoggedIn();

  console.log('sending message to ' + job.target[0].address);
  client.send(
      job.target[0].address,
      job.object.text
  );
  promise.fulfill(null, true);

  return promise;
}

function requestFriend(job) {
  var promise = promising();
  isLoggedIn();

  console.log('friend request to ' + job.target[0].address);
  client.subscribe(
      job.target[0].address
  );
  promise.fulfill(null, true);

  return promise;
}

function removeFriend(job) {
  var promise = promising();
  isLoggedIn();

  console.log('friend removal of ' + job.target[0].address);
  client.unsubscribe(
      job.target[0].address
  );
  promise.fulfill(null, true);

  return promise;
}

function makeFriend(job) {
  var promise = promising();
  isLoggedIn();

  console.log('friend request confirmation to ' + job.target[0].address);
  client.acceptSubscription(
      job.target[0].address
  );
  promise.fulfill(null, true);

  return promise;
}

function update(job) {
  var promise = promising();
  isLoggedIn();

  console.log('setting presence: ', JSON.stringify(job.object));
  var show = job.object.type === 'available' ? '' : job.object.type;
  var status = job.object.status || '';

  client.conn.send(
    new client.nodeXmpp.Element('presence', {
      to: (job.target && job.target.address ?
           job.target.address : job.actor.address)
    }).c('show', show).up().c('status', status)
  );
  promise.fulfill(null, true);

  return promise;
}


onmessage = function (m) {
  assert.ok(m.verb);

};

