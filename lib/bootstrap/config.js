var nconf = require('nconf'),
    debug = require('debug')('sockethub:bootstrap:config');

module.exports = function () {
  debug('loading config defaults');
  // assign config loading priorities (command-line, environment, cfg, defaults)
  nconf.argv({
    'port': {
      alias: 'service.port'
    },
    'host': {
      alias: 'service.host'
    }
  })
 .env()
 .file({ file: __dirname + '/../../config.json' })
 .file({ file: __dirname + '/../defaults.json' });
};
