var assert = require('assert');
var ap = require('assert-plus');
var obj1 = {
  hello: 'world',
  foo: ['bar', 'baz', {
    peanut: 'butter'
  }],
  runme: function() {
    console.log('oh hai');
  }
};
if ({} === {}) {
console.log('hi');
}
var obj2 = {
  foo: ['bar', {
    peanut: 'butter'
  }, 'baz'],
  runme: function() {
    console.log('oh hai');
  },
  hello: 'world'
};

var obj3 = {
  hello: 'world',
  foo: ['bar', 'baz', {
    peanut: 'butterses'
  }],
  runme: function() {
    console.log('oh hai');
  }
};

var X = function () {
  return {};
};
var x1 = new X();
var x2 = new X();

x1.hello = 'world';
x2.hello = 'world';

console.log('x1:',JSON.stringify(x1));
console.log('x2:',JSON.stringify(x2));

//if (JSON.stringify(obj1) === JSON.stringify(obj2)) {
//  console.log('strings match');
//}

if(ap.object(obj1, obj2)) {
  console.log('ys');
}

if(assert.deepEqual(x1, x2, 'yaya')) {
  console.log('obj1 and obj2 match');
} else {
  console.log('obj1 and obj2 DONT MATCH');
}
