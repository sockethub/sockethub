if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

if (typeof (window) !== 'undefined') {
  // browser
  define([], function () {
    return [
      'grey',
      'red',
      'green',
      'yellow',
      'blue',
      'purple',
      'cyan',
      'greybg',
      'redbg',
      'greenbg',
      'yellowbg',
      'bluebg',
      'purplebg',
      'cyanbg',
      'reset'
    ].reduce(function (colors, name) {
      if (name == 'reset') {
        colors[name] = '</span>';
      } else if (name.match(/^(.+)bg$/)) {
        colors[name] = '<span style="background-color: ' + name.match(/^(.+)bg$/)[1] + ';">';
      } else {
        colors[name] = '<span style="color: ' + name + ';">';
      }
      return colors;
    }, {});
  });
} else {
  define(['tty'], function (tty) {
    var term = tty.isatty(1);
    var colors = {
      grey: (term) ? '\u001b[30m' : '',
      red: (term) ? '\u001b[31m' : '',
      green: (term) ? '\u001b[32m' : '',
      yellow: (term) ? '\u001b[33m' : '',
      blue: (term) ? '\u001b[34m' : '',
      purple: (term) ? '\u001b[35m' : '',
      cyan: (term) ? '\u001b[36m' : '',
      greybg: (term) ? '\u001b[40m' : '',
      redbg: (term) ? '\u001b[41m' : '',
      greenbg: (term) ? '\u001b[42m' : '',
      yellowbg: (term) ? '\u001b[43m' : '',
      bluebg: (term) ? '\u001b[44m' : '',
      purplebg: (term) ? '\u001b[45m' : '',
      cyanbg: (term) ? '\u001b[46m' : '',
      reset: (term) ? '\u001b[0m' : ''
    };
    return colors;
  });
}
