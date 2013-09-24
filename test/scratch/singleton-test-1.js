
module.exports = function (p) {
  var s = require('./singleton.js');

  var i = s.getInstance(p);
  console.log('i: '+i.getRandomNumber());

  var t = s.getInstance(p);
  console.log('t: '+t.getRandomNumber());
};
