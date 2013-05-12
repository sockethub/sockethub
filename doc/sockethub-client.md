# General overview for using the Sockethub client

## connect

```
  var sc;
  SockethubClient.connect({
    host: 'ws://'+host+':'+port+'/sockethub',
    confirmationTimeout: 3000 // timeout in ms to wait for a response from sockethub before the promise fails
  }).then(function (connection) {
    sc = connection;
    sc.on('message', function (data) {
      console.log('received a new message from sockethub: ', data);
    });

    sc.on('error', function (data) {
      console.log('received an error from sockethub: ', data);
    });

    sc.on('close', function (data) {
      console.log('received a close from sockethub: ', data);
    });

    sc.on('message', function (data) {
      console.log('received a new message from sockethub: ', data);
    });
  }, function (err) {
    console.log('error connection to sockethub: ', err);
  });
```


## register


```
  sc.register({
    secret: '1234567890'
  }).then(function () {
    console.log("we're registered, hooray!");
  }, function (err) {
    console.log('failed to register with sockethub :( ', err);
  });
```


## set
To set credentials for the platforms we will want to use

```
  sc.set('facebook', {
    credentials: {
      me: {
        access_token: access_token
      }
    }
  }).then(function () {
    console.log('successfully set credentials for facebook account');
  }, function (err) {
    console.log('error setting credentials for facebook :( ', err);
  });
```


## submit
generic function to send data to sockethub

```
  sc.submit({
    platform: 'facebook',
    verb: 'post',
    actor: { address: 'me' },
    target: [{ address: 'friendsusername' }],
    object: {
      text: 'Hello facebook, love Sockethub'
    }
  }, 10000).then(function (response) {
    console.log('post sucessful, heres the response: ', response);
  }, function (err) {
    console.log('oh no! ', err);
  });
```



