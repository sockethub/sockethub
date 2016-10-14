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
   .env();

  // get value of flags defined by any command-line params
  var examples = nconf.get('examples');

  // Load the defaults, override with the config file at the root
  nconf.file({ file: __dirname + '/../defaults.json' })
       .file({ file: __dirname + '/../../config.json' });

  // only override config file if explicitly mentioned in command-line params
  nconf.set('examples:enabled', (examples ? true: nconf.get('examples:enabled')));
};
