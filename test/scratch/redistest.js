var redis = require('redis');
var One = {
  state: 'foo',
  create: function () {
    var _this = this;
    return {
      get: function () {
        return _this.state;
      },
      set: function (val) {
        _this.state = val;
      }
    };
  }
};

var t1 = One.create();
var t2 = One.create();

console.log('t1.get: '+t1.get());
console.log('t2.get: '+t2.get());
console.log('t2.set(bar): '+t2.set('bar'));
console.log('t1.get: '+t1.get());
console.log('t2.get: '+t2.get());


var Two = function () {
  return {
    state: 'foo',
    create: function () {
      var _this = this;
      return {
        get: function () {
          return _this.state;
        },
        set: function (val) {
          _this.state = val;
        }
      };
    }
  };
};

var u1 = Two().create();
var u2 = Two().create();

console.log('u1.get: '+u1.get());
console.log('u2.get: '+u2.get());
console.log('u2.set(bar): '+u2.set('bar'));
console.log('u1.get: '+u1.get());
console.log('u2.get: '+u2.get());

















var c1 = redis.createClient();
var c2 = redis.createClient();
var c3 = redis.createClient();
var c4 = redis.createClient();
var c5 = redis.createClient();
var count1 = 0;
var count3 = 0;
var count5 = 0;
var msgNum = 21;
c1.subscribe('test');
c1.on('message', function (channel, data) {
  count1 = count1 + 1;
  console.log('c1 received message on '+channel+' channel: '+data);
});


c3.subscribe('test');
c3.on('message', function (channel, data) {
  count3 = count3 + 1;
  console.log('c3 received message on '+channel+' channel: '+data);
});


c5.subscribe('test');
c5.on('message', function (channel, data) {
  count5 = count5 + 1;
  console.log('c5 received message on '+channel+' channel: '+data);
});

for (var i = 0; i < msgNum; i++) {
  c4.publish('test', 'yoyoyo');
}


setTimeout(function () {
  console.log('count1:'+count1+' msgNum:'+msgNum);
  console.log('count3:'+count3+' msgNum:'+msgNum);
  console.log('count5:'+count5+' msgNum:'+msgNum);
  /*c1.quit();
  c2.quit();
  c3.quit();
  c4.quit();
  c5.quit();*/
}, 2000);
