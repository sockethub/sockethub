![jaribu](https://raw.github.com/silverbucket/jaribu/master/design/jaribu_logo.png)

*a JavaScript (browser & node.js) testing framework*

[![Build Status](http://img.shields.io/travis/silverbucket/jaribu.svg?style=flat)](http://travis-ci.org/silverbucket/jaribu)
[![Code Climate](http://img.shields.io/codeclimate/github/silverbucket/jaribu.svg?style=flat)](https://codeclimate.com/github/silverbucket/jaribu)
[![Dependency Status](http://img.shields.io/david/silverbucket/jaribu.svg?style=flat)](https://david-dm.org/silverbucket/jaribu#info=dependencies)
[![license](https://img.shields.io/npm/l/jaribu.svg?style=flat)](https://npmjs.org/package/jaribu)
[![downloads](http://img.shields.io/npm/dm/jaribu.svg?style=flat)](https://npmjs.org/package/jaribu)
[![release](http://img.shields.io/github/release/silverbucket/jaribu.svg?style=flat)](https://github.com/silverbucket/jaribu/releases)


# Intro
Jaribu is a JavaScript testing framework that runs both in the browser and via node.js. It's meant to keep things simple, and make the barrier for writing tests as thin as possible, and to run in as many javascript environments as possible.

# Features

**Console-based testing** : jaribu will automatically find tests in `test/*-suite.js` when run from console. 

`$ node_modules/.bin/jaribu`

**Browser testing** : When run from the browser, you can create a simple `test/index.html` file like the following:

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

For tests which are designed to only run on the server, you can add a `runInBrowser: false` boolean to the suite properties.

**Shared environments** : a suite has an 'env' object which you can write to and that data will be available for any test in that suite.

```javascript
  suites.push({
    name: "test suite",
    desc: "example",
    setup: function(env) {
      env.foo = 'bar';
    },
    tests: [
      {
        desc: "we should have the foo property",
        run: function(env, test) {
          test.assert(env.foo, 'bar');  // true
        }
      },
      {
        desc: "lets set a var",
        run: function(env, test) {
          env.pizza = 'slice';
          test.assert(env.pizza, 'slice');  // true
        }
      },
      {
        desc: "verify it's still there",
        run: function(env, test) {
          test.assert(env.pizza, 'slice');   // true
        }
      },
      {
        desc: "remove a variable",
        run: function(env, test) {
          delete env.foo;
          test.assertType(env.foo, 'undefined');   // true
        }
      },
      {
        desc: "we shouldn't be able to access the deleted property",
        willFail: true,
        run: function(env, test) {
          test.assert(env.foo, 'bar');   // false
        }
      }
    ]
  });
```

# Output

Generally speaking, when the tests are passing as expected, the output will be
minimal. The description of each suite of tests will be displayed, followed by 
a series of `+` and `!+` characters, and any errors if they occur.

- `+` means the test passed. 

- `!+` means the test failed, but this was expected (treated as a pass).

At the end of all test running, there will be a summary describing the total
number of tests (and meta-tests, known as scaffolding) run, failures, passes, etc.


# API

## Asserts
You can use the assert family of functions to compare values with each other
(objects, arrays, strings, types).

### assert()
The `assert()` function compares two objects for truthiness and passes or fails
the test based on the result of the comparison.

```javascript
  assert(object1, object2, "testing object1 and 2 are the same")
```

### assertAnd()
Same as `assert()` except does not pass the test automatically when the result
is true. If the objects *do not* match, however, the test will fail.

### assertFail()
Behaves the opposite of `assert()`, test will pass if the objects do not match.

### assertFailAnd()
Behaves the opposite of `assertAnd()`, test will not fail if objects do not
match, and will fail automatically if objects match.

### assertType()
The `assertType()` function tests the type of a given variable *(object, string,
boolean, array, etc.)*. NOTE: can use 'array' as a type.

```javascript
  assertType(object, 'object', "testing object is actually an object")
```

### assertTypeAnd()
Same as `assertType()` except does not pass the test automatically when the
result is true. If the object type is *incorrect*, however, the test will fail.

### assertTypeFail()
Behaves the opposite of `assertType()`, test will succeed if the type of
object is incorrect, and will automatically fail if the types match.

### assertTypeFailAnd()
Behaves the opposite of `assertTypeAnd()`, test will not fail if the type of
object is incorrect, and will automatically fail if the types match.

## Mocks and Stubs
Technically they are all mocks, since they have info about whether they've been
called, and how many times, but can be used as stubs as well (which are
basically just mocks without meta data).

```javascript
  var mock = new this.Stub(function(p1, p2) {
    console.log('hello world');
  });

  mock.called;  // false

  mock.numCalled;  // 0

  mock();  // hello world

  mock.called;  // true

  mock.numCalled;  // 1
```

## Testing for thrown exceptions
Catching thrown exceptions works with normal thrown exceptions or exceptions
thrown asyncronously. The interface is the same either way, just call the
function you want to test. If it throws an exception, the test passes.

```javascript
  this.throws(function () {
    throw new Error('oops');
  }, Error, 'caught thrown exception');
```

## Shortcuts

When resolving tests there are a number of calls you can make.

```javascript
  test.result(false, 'this broke because ...'); // fails test with message
  test.result(true); // passes test
  test.done(); // passes test
  test.fail('problem with stuff ...'); // fails test with message
```

