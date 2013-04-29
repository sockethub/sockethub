# 1. Install
make sure you followed the [install instructions](install.md)

# 2. Connect
Your unhosted web app will have to connect to the user's sockethub instance.
This is done via a WebSocket. you have to get the host and port from the user (default is ws://localhost:10550/),
and one of the secrets they configured in their config.secrets.js file (defaults are 1234567890 and 0987654321).

Once you got these details from the user, try to open a WebSocket to the host and port, path '/', protocol 'sockethub':
````js
    var sock = new WebSocket('ws://localhost:10550/', 'sockethub');
````
# 3. Send register command
The first thing your app has to send once the socket is open is a 'register' command:
````js
var secret;//make sure this variable is available to the sock.onopen handler from parent scope
sock.onopen = function() {
  sock.send(JSON.stringify({
    platform: 'dispatcher',
    verb: 'register',
    object: {
      secret: secret
    },
    rid: new Date().getTime()
  }));
};
````
# 4. Receive response
````js
sock.onmessage = function(e) {
  var data;
  try {
    data = JSON.parse(e.data);
  } catch(err) {
    console.log('bogus message: '+e.data);
    return;
  }
  console.log('[sockethub IN]', JSON.stringify(data));
  if(data.verb == 'confirm') {
    return;
  }
  if(data.rid && data.rid == registerRid && data.verb == 'register') {
     if(data.status) {
       console.log('register successful');
    } else {
      console.error(data.message);
    }
  } else {
    console.log(data);
  }
};
````
# 5. Deal with lost connections
Sometimes, the sockethub server will restart, and you want your app to reconnect if that happens.
Put all the previous code (setting the sock variable, and assigning its event handlers) into a function
called 'connect', and then (also inside that 'connect' function), add an onclose handler:
````js
sock.onclose = function() {
  if(secret) {//again, make sure this variable is available in the parent scope
    connect();
  } else {
    //will also happen if connection was refused or timed out:
    console.error('could not connect to the sockethub server on '+host);
  }
}
````

# 6. Set credentials
Let's assume your app allows the user to post something on facebook. As you can see in
[the schema definition](https://github.com/sockethub/sockethub/blob/506bdd5d065e254a652ce57ff6d7925564343b54/lib/protocols/sockethub/platforms/facebook.js#L10)
facebook credentials take the following form:
````js
{
  example_user: {
    actor: {
      address: 'example_user'
    },
    access_token: 'abcde'
  }
}
````
Other platforms take different syntaxes, see the
[demo code](https://github.com/sockethub/sockethub/blob/506bdd5d065e254a652ce57ff6d7925564343b54/html/index.html#L161)
for an overview.

So the way to send the credentials is with a 'set' verb, as follows:
````js
sock.send(JSON.stringify({
  platform: 'dispatcher',
  verb: 'set',
  object: {
    credentials: {
      username: {
        actor: {
          address: "username"
        },
        access_token: "..."
      }
    }
  },
  target: {
    platform: 'facebook'
  },
  rid: new Date().getTime()
}));
````

# 7. Post something

Once you've connected, registered, and set the credentials, actually posting something to a platform is simple. To let
the user post something onto their own feed, your app should do the following:
````js
sock.send(JSON.stringify({
  platform: 'facebook',
  verb: 'post',
  actor: {
    address: 'example_user'
  },
  object: {
    text: 'hello world!'
  },
  target: {
    to: [
      {
        address: 'me'
      }
    ]
  },
  rid: new Date().getTime()
}));
````
