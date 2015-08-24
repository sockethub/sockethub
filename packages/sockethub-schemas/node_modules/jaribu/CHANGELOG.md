CHANGELOG
=========

jaribu v2.0.0  - 2015/05/04
---------------------------

- greatly minimized text output during testrunning to a `+` for pass, `!+` for failed but expected (aka. pass) and only displaying verbose data when there's a failure. 


jaribu v1.1.0  - 2015/03/30
---------------------------

- running jaribu tests in browser now as well (aside from websocket and rest tests which need server functionality)

- added `display.write` for browser as well as console

- exception handling for `test.throws()` method extended to work in browser

- more Promise object bugfixes

- more bugfixes related to dynamic loading of dependencies using aliases

- renamed `test.tools.*` to `test.helpers` **(breaking change)**


jaribu v1.0.1  - 2015/03/30
---------------------------

- Promise object bugfixes


jaribu v1.0.0  - 2015/03/30
---------------------------

- switching to `v1.0.0` and following semver

- reworked module loadng to use AMD aliases rather than paths, so the locations can be defined at runtime

- added display functions for use in a browser environment

- created fetch.json test tool `test.fetch.json` which operates like `test.helpers.fetch` except has promise handling and json parsing built in

- created `browser/main.js` for browser-based tests to include and bootstrap jaribu in the browser. Only the following HTML is needed in the projects `test/` dir:

```html
<!DOCTYPE html>
<html>
<head><title>tests</title></head>
<body>
<div id="jaribuTestOutput"></div>
<script>
var jaribuTestFiles = [
    'test1-suite.js',
    'test2-suite.js', 
    'test3-suite.js' 
    ];
</script>
<script data-main="../node_modules/jaribu/browser/main.js" src="../node_modules/jaribu/node_modules/requirejs/require.js"></script>
</body>
</html>
```

jaribu v0.4.0  - 2015/03/29
---------------------------

- completely removed dependency on `jquery` (removed from `test.tools.jquery`) **(breaking change)**

- removed `test.http` helper in favor of `test.tools.fetch` **(breaking change)**

- updated dependencies


jaribu v0.3.0  - 2014/12/27
---------------------------

- added support for using type 'array' within `assertType`


jaribu v0.2.2  - 2014/10/14
---------------------------

- another version bump to get around broken dependency packages
  

jaribu v0.2.1  - 2014/10/13
---------------------------

- stricter npm dependency versions, fix for a broken npm package


jaribu v0.2.0  - 2014/09/26
---------------------------

- added `test.fail()` function to easily pass promise errors directly to
  jaribu.

    myLib.myMethod(function(yes) {
        test.assert(yes, true);
    }, test.fail).catch(test.fail);

- lots of code cleanup and improvements to readability.


jaribu v0.1.10 - 2014/05/21
---------------------------

- fix deep object assertion making sure we only fail if one objects 
  property returns true for hasOwnProperty() while it returns fails 
  for the other object


jaribu v0.1.9 - 2014/03/31
--------------------------

- fix in object assertion, an object with no properties was asserting 
  as the same as an object with an undefined property. [issue #26](http://github.com/silverbucket/jaribu/issues/26)


jaribu v0.1.8 - 2014/03/15
--------------------------

- fixed informational messages displayed during `test.assertFail()` and 
  `test.assertFailAnd()` failures.


jaribu v0.1.6 - 2014/03/04
--------------------------

- added http DEL and PUT functionlity to Http object.


jaribu v0.1.4 - 2014/03/03
--------------------------

- renamed project to 'jaribu'.

- initial work on using tests within a browser environment (thanks @ggrin)

- better array comparisons during assert (thanks @michielbdejong)

- added some http test as examples.


jaribu v0.1.2 - 2013/12/21
-------------------------

- improved stack trace reporting during failures.


jaribu v0.1.1 - 2013/12/18
-------------------------

- fixed assert* informational messages. In some cases the automatic messages
  which indicated the location where the object match failed was being set as
  undefined.


jaribu v0.1.0 - 2013/12/10
-------------------------

- bugfix for custom error messages during `assert*()`'s. Previously it wasn only
  working for `assertAnd()`. ([issue #14](http://github.com/silverbucket/jaribu/issues/14))

- testing tools (functions) which previously needed the test object passed in,
  don't anymore.

- added support for testing for thrown exceptions. ([feature request #15](http://github.com/silverbucket/jaribu/issues/14))

		this.throws(function () {
			throw new Error('oops');
		}, Error, 'caught thrown exception');

- fixed an issue where the maximum call stack size was being exceeded when
 	running thousands of tests.

- refactoring and improvement of code clarity (using codeclimate.com as a
	benchmark)


jaribu v0.0.19 - 2013/11/15
--------------------------

- refactored the jaribu.loadSuite() function to reduce function complexity,
	splitting out class functions to separate files: `lib/Scaffolding.js`,
	`lib/Teste.js`, `lib/Suite.js`, `lib/helpers.js`.
	(https://codeclimate.com/github/silverbucket/jaribu).

- minor adjustments to logging behavior.

- if a jaribu returns a promise with a `fail` function, we can use that to catch
	unexpected errors.


jaribu v0.0.18 - 2013/07/10
--------------------------

- Fixes to WebSocketClient tool


jaribu v0.0.17 - 2013/06/23
--------------------------

- added `abortOnFail` boolean to suite options. If a test fails in that suite,
	entire execution is halted. This is useful for cases where you know
	everything is going to break if any tests in a suite fail.

  	suites.push({
	    desc: "checks for various version requirements",
	    abortOnFail: true,  // don't continue with further test suites if any
	                        // tests in this suite fail
	    setup: function (env, test) {
	    	...
	    },
	    tests: [{...}]
	  });


jaribu v0.0.16 - 2013/03/20
--------------------------

- minor bugfixes for assert and WebSocketClient


jaribu v0.0.15 - 2013/03/09
--------------------------

- decreased wait interval so async tests complete faster.

- added done() as an alias to result() for tests.

- minor fixes, binded functions so they can be used as callbacks.


jaribu v0.0.14 - 2013/02/14
--------------------------

- bugfixes in the assert and WebSocketClient tools.


jaribu v0.0.13 - 2013/01/30
--------------------------

- created a new function for the `WebSocketClient`, called `sendWith()`. it's
	meant to replace all of the functionality of both `sendAndVerify()` and
	`sendWithCallback()`, using a single properties object (param object), this
	we the function can be extended, and modified in the future without worrying
	about param order, instead sending a single object with named properties.

	A list of all available properties at this time:

		// {
		//   send: JSON.stringify(data),
		//   expect: expected,
		//   confirmProps: confirmProps,
		//   autoVerify: true,
		//   onComplete: function() { }, // if callback function is called,
		//															 // verification is used with assertAnd,
		//                               // not assert.
		//
		//   onMessage: function() { },  // mutually exclusive to autoVerify, if
		//                               // autoVerify is set, this is not called
		//
		//   onError: function() { },  // mututall exclusive to autoVerify
		//                             // autoVerify is set, this is not called
		// }


jaribu v0.0.12 - 2013/01/28
--------------------------

- added support for confirmation messages in `WebSocketClient.sendAndVerify()`
	function. this allows you to say you are expecting a confirmation message
	before the actual result you eventually want to test.

		var confirmProps = {
			status: true,
			verb: 'confirm'
		};
		var data = {
			platform: "dispatcher",
			object: {
				secret: '1234567890'
			},
			verb: "register",
			rid: "123454"
		};
		var expected = {
			status: true,
			rid: "123454",
			verb: 'register',
			platform: "dispatcher"
		};
		env.connection.sendAndVerify(JSON.stringify(data), expected, test, confirmProps);

	Params are: data to send, expected result data, test object, confirm
	properties.


jaribu v0.0.11 - 2013/01/17
--------------------------

- modified WebSocketClient's sendAndVerify() function. Now it takes three
	params: send data, expected data, and test object. and you no long pass
	'messages' data to client.

		setup: function(env, test) {
			env.expected = { // struct of expected results for each http call
				setupTest: 'setupTest',
				test: {
					foo: "bar"
				},
				footwear: {
					leather: "boots",
					flip: "flops",
					block: "of wood"
				}
			};

			var client = new this.WebSocketClient({
				url: 'ws://localhost:9992/',
			});

			client.connect(function(connection) {
				env.connection = connection;
				env.connection.sendAndVerify('setupTest', env.expected.setupTest, test);
			});
		},
		tests: [
			{
				desc: 'auto validate websocket command',
				run: function (env, test) {
					env.connection.sendAndVerify('footwear', env.expected.footwear, this); // passes
				}
			},
			{
				desc: 'the first level of properties are the commands',
				run: function (env, test) {
				env.connection.sendAndVerify('blah', 'lalala', test); // fails
				}
			}
		]

jaribu v0.0.10 - 2013/01/15
--------------------------

- support for promises in tests:

		{
			desc: "async call making use of promises",
			run: func(env, test) {
				return someAsyncCall(function(result) {
					test.assert(result, 'success');
				});
			}
		}

- failing tests now get a generic stack trace to aid in debugging.

- added second parameter to all tests, the 'test' object will help in cases
	where you constantly have to re-assign 'this' due to async callbacks.

		{
			desc: 'test with this',
			run: func(env) {
				this.result(true);
			}
		},
		{
			desc: 'test with test param',
			run: func(env, test) {
				someAsyncFunction(function(status) {
					test.result(status);
				});
			}
		}

- assert*() functions now take an optional 3rd parameter which is printed along
	with the error message when the assert fails, for more informative
	information.

- bugfixes where assert*And() fails were slipping through the cracks


jaribu v0.0.9 - 2012/11/25
-------------------------

- added support for performing tests against WebSocket servers. If you provide
	the WebSocketClient with the expected data result for each command you can use
	auto verification to easily test the responses.

		setup: function(env) {
			env.expected = { // struct of expected results for each http call
				setupTest: 'setupTest',
				test: {
					foo: "bar"
				},
				footwear: {
					leather: "boots",
					flip: "flops",
					block: "of wood"
				}
			};

			var client = new this.WebSocketClient({
				url: 'ws://localhost:9992/',
				messages: env.expected  // data struct of commands and expected
											// results
			});

			var _this = this;
			client.connect(function(connection) {
				env.connection = connection;
				env.connection.sendAndVerify('setupTest', _this);
			});
		},
		tests: [
			{
				desc: 'auto validate websocket command',
				run: function(env) {
					env.connection.sendAndVerify('footwear', this); // passes
				}
			},
			{
				desc: 'the first level of properties are the commands',
				run: function(env) {
				env.connection.sendAndVerify('blah', this); // fails
				}
			}
		]


jaribu v0.0.8 - 2012/11/08
-------------------------

- added support for HTTP GET / POST testing, using a simple jQuery wrapper. All
	you can do with jQuery.ajax() applies. But for simple cases:

		{
			desc: 'http get example',
			run: function(env) {
				var _this = this;
				env.http = new this.Http()
				env.http.get('/', {
					success: function(data, textStatus, jqXHR) {
						_this.assert(data, <expected_data>);
					},
					error: function() {
						_this.result(false, 'failed');
					}
				});
			}
		},
		{
			desc: 'http post example',
			run: function(env) {
				var _this = this;
				env.http.post('/', {foo:'bar'}, {
					success: function(data, textStatus, jqXHR) {
						_this.assert(data, <expected_data>);
					},
					error: function() {
						_this.result(false, 'failed');
					}
				});
			}
		}

- added a simple JSON HTTP server. It takes a data struct as an argument and
	uses it to make URIs/results.

		setup: function(env) {
			var data = { // struct of expected results for each http call.
				test: { // the first set of properties are URIs, all children
						// of these properties are the data returned.
					foo: "bar"
				}
			};
			var server = new this.HttpServer({
				port: 9991,
				uris: data
			});
			var _this = this;
			server.run(function() {
				_this.write('http dummy server running');

				var http = new _this.Http({
					baseUrl: 'http://localhost:9991'
				});

				env.http.get('/test', {
					success: function(data, textStatus, jqXHR) {
						_this.assert(data, {foo:'bar'});
					},
					error: function() {
						_this.result(false, 'failed http request on /');
					}
				});
			});
		}

- added stack traces for failures


jaribu v0.0.7 - 2012/11/06
-------------------------

- added support for specifying suite files to run via. the command-line
	(@nilclass)

- switched to using requirejs by default for all file inclusions. Suite files
	now begin like this:

		if (typeof define !== 'function') {
			var define = require('amdefine')(module);
		}
		define(['requirejs'], function(requirejs, undefined) {
			var suites = [];
			// ... tests
			 return suites;
		});


jaribu v0.0.6 - 2012/10/28
-------------------------

- encase test and scaffolding runs in a try/catch clause

- now use the term 'willFail' for announcing ahead of time that a test with
	fail.

		{
			desc: "this test will fail, and that should pass",
			willFail: true,
			run: function(env) {
				this.result(false);
			}
		}

- display output now handled by the display.js library, which currently just
	supports console output, but can be extended to support HTML output (once we
	get in-browser testing working).

- added test functions `this.assertFail()`, `this.assertFailAnd()`,
	`this.assertTypeFail()`, `this.assertTypeFailAnd()`.


		{
			desc: "if an assertFail fails, that resolves to a passed test",
			run: function(env) {
				this.assertFailAnd(true, false);
				this.assertFail('blah', 'bad');
			}
		}

