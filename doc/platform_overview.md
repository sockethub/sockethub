# Platforms

Information about sockethub `platforms`, a platform is a simple nodejs module which can provide various functionality.

This document is targeted toward app developers, and not necessarily sockethub platform developers. For details on implementing a sockethub platform see [adding a platform](adding_a_platform.md).


## Using a platform

When we've connected to sockethub, and want to use a platform, the first thing we should do is set any credential information for that platform. Once we do this we won't have to do it again for the duration of the session.


## Setting credentials

Before using a platform, it must have the correct credentials for the user(s) in which will it will be acting on behalf of. To set these credentials, there is a `set` verb which stores the credentials in an encrypted blob (key is discarded after session), available only for this sessions platform to retreive when fetching or sending messages.

Here's what a credential setting would look like, lets use [the twitter platform as an example](https://github.com/sockethub/sockethub/blob/master/lib/platforms/twitter.js), and assume our username is nachoslinger:

		{
			'rid': '002',
			'platform': 'dispatcher',
			'verb': 'set',
			'target': [{'platform': 'twitter'}],
			'object': {
				'credentials': {
					'nachoslinger': {
						'access_token':         '# token from twitter #',
						'access_token_secret':  '# token from twitter #',
						'consumer_secret':      '# token from twitter #',
						'consumer_key':         '# token from twitter #',
						'actor': {
							'address': 'nachoslinger',
							'name':    'Nacho Slinger'
						}
					}
				}
			}
		}

*the rid can be any string we want, there is no structure, it's just a means for the developer to keep track of which responses correlate to which request.*


### confirming success

After we set our credentials, we should receive both a confirmation message (confirming the request has been delivered to the right place), and afterward a response back with the status of the request.

First the confirmation:

  {
  	rid: '002',
  	verb: "confirm",
  	status: true
  }

Then the response:

	{
		rid: '002',
		verb: "set",
		platform: "dispatcher",
		status: true
	}

*the rid will correllate with the one we sent*


### what failures look like

In the event we got something wrong, we should get a confirmation success, but a response failure:

Confirmation:

	  {
  		rid: '002',
  		verb: "confirm",
  		status: true
  	}

Failure response:

		{
			rid: '002',
			platform: 'dispatcher',
			verb: 'set',
			status: false,
			message: 'invalid object format [{"uri":"urn:uuid:7973613e-eb8d-4477-9497-ee3aa1f92896#/credentials/sdd","schemaUri":"urn:uuid:6fb353f2-d0d2-4ac4-b58e-edd2b2b7deea#/properties/credentials/patternProperties/.%2B","attribute":"type","message":"Instance is not a required type","details":["object"]}]'
		}

*the message output for schema errors is used directly from the [JSV](https://github.com/garycourt/JSV) json schema validation library for node.js, unfortunately the error messages are not exactly human friendly, hopefully this can be corrected in the future.*

### using sockethub-client

If we use the [sockethub-client](https://github.com/sockethub/sockethub-client) library, this simplifies the task of checking for successful results.

First we connect and register:

		var sockethubClient = SockethubClient.connect({
		  host: 'localhost',
		  register: {
		    secret: '1234567890'
		  }
		});

		sockethubClient.on('registered', function() {
		  // done!
		  // you can start calling verbs now
		});


*for more details of using sockethub-client, please check the [sockethub-client project page](https://github.com/sockethub/sockethub-client)*


Then we send the `set` command for the `twitter` platform:

		sc.set('twitter' {
			'credentials': {
				'nachoslinger': {
					'access_token':         '# token from twitter #',
					'access_token_secret':  '# token from twitter #',
					'consumer_secret':      '# token from twitter #',
					'consumer_key':         '# token from twitter #',
					'actor': {
						'address': 'nachoslinger',
						'name':    'Nacho Slinger'
					}
				}
			}
		}).then(function () {
			// success
		}, function (err) {
			// error
		});

### each platforms credential data structure

Each platform has different types of credential data it needs to complete it's tasks (and some, like the `rss` platform, don't need any credentials).

For a master list of valid credential data structs for each platform, see [credentials](https://github.com/sockethub/sockethub/blob/master/examples/credential-config.js).


## Sending jobs to sockethub

Now that we've set the credentials for the twitter platform, we can go ahead and send a job. Using the sockethub-client, we can use the sendObject function:


### POST

		sc.sendObject({
			'platform': 'twitter',
			'verb': 'post',
			'actor': {
				'address': 'nachoslinger',
				'name': 'Nacho Slinger'
			},
			'target': [],
			'object': {
				'text': "Hello from @nachoslinger 's #sockethub app!"
			}
		}).then(function (response) {
      console.log('post sucessful, heres the response: ', response);
    }, function (err) {
      console.log('oh no! ', err.message);
    });


The sockethub-client library will assign the `rid` property itself so it can automate tracking the results of confirmation and response messages.


### FETCH

We've learned how to post a message, but what if we want to get our feed list? Sockethub handles jobs which require more than one response asyncronously.

Whenever a message arrives from sockethub, the sockethub-client fires a `message` event. Let's set our listener now:

	sc.on('message', function (o) {
		// o is out sockethub object
		console.log(o.platform + o.verb + ' from ' o.actor.address);
	});

	// should print something like:
	//    twitter post from guysmiley

Then we send a `fetch` verb to sockethub, which tells it to send back posts from our feed `target`.

  sc.sendObject({
		'platform': 'twitter',
		'verb': 'fetch',
		'actor': {
			'address': 'nachoslinger',
		},
		'target': []
	}).then(function (response) {
    // this won't contain posts from your timeline, those come in via. the 'message' event
    console.log('fetch sucessful, heres the response: ', response);
  }, function (err) {
    console.log('oh no! ', err.message);
  });


As posts come in via the `message` event, you can then do what you need to do to display each post.

To specify another users timeline, not your own, you can add a target object to the target array.

		...
		'target': [
			{
				'address': 'guysmiley'
			}
		]
		...
