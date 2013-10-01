
var Session = function () {};

Session.prototype.helloWorld = function () {
  console.log('hello world');
};


var Instance = function () {};

Instance.prototype = new Session();

Instance.prototype.sayHello = function () {
  this.helloWorld();
};

var i = new Instance();

i.sayHello();

