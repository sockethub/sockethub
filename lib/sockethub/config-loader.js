/**
 * Function: ConfigLoader
 *
 * handles the actual require'ing of the config file and providing all the
 * default values for any missing fields, or params passed via. the command-line
 * at runtime.
 *
 * Parameters:
 *
 *   param   - can be a string (path to config file) or an object (data from an
 *                 existing loaded config file)
 *   cmdline - an object of params passed at the command-line
 *
 * Returns:
 *
 *   config object
 */
function ConfigLoader(param1, param2, cmdline) {
  var configFile, config, secretsFile, secrets;
  if (typeof param1 === 'string') {
    // param is path of config file to load
    configFile = param1;
  } else if (typeof param1 === 'object') {
    // param is object of config values
    config = param1;
  }

  if (typeof param2 === 'string') {
    // param is path of config file to load
    secretsFile = param2;
  } else if (typeof param2 === 'object') {
    // param is object of config values
    secrets = param2;
  }

  //
  // first try to load the config from a file if string was passed
  if (configFile) {
    try {
      config = require(configFile).config;
    } catch (e1) {
      try {
         configFile = './../../' + configFile;
         config = require(configFile).config;
       } catch (e2) {
      	 try {
           configFile = './../../config.js.template';
           config = require(configFile).config;
        } catch (e3) {
          console.error(' [config] unable to load config: ' + configFile, e3);
          throw new Error('unable to load config: ' + configFile);
        } 
      }
    }
    config.CONFIG_FILE = configFile;
  }

  //
  // first try to load the config from a file if string was passed
  if (secretsFile) {
    try {
      secrets = require(secretsFile);
    } catch (e1) {
      try {
         secrets = require('./../../'+secretsFile).config;
       } catch (e2) {
      	 try {
           secrets = require('./../../config.secrets.js.template');
        } catch (e3) {
          console.error(' [config] unable to load secrets file: ' + secretsFile, e3);
          throw new Error('unable to load secrets: ' + secretsFile);
        } 
       }
    }
    config.SECRETS_FILE = secretsFile;
  }

  if ((typeof secrets === 'object') && (!config.SECRETS)) {
    config.SECRETS = secrets;
  }


  //
  // next apply any command-line args over existing config
  if (typeof cmdline === 'object') {
    // flags from command-line execution
    config.DEBUG = cmdline.debug || config.DEBUG || false;
    config.LOG_FILE = cmdline.log || config.LOG_FILE || false;
    config.VERBOSE = (cmdline.verbose) ? cmdline.verbose : (config.LOG_FILE) ? false : true;
  }

  //
  // set defaults
  config.PLATFORMS = config.PLATFORMS || [];
  config.NUM_WORKERS = (typeof config.NUM_WORKERS === 'number') ? config.NUM_WORKERS : 1;
  if (config.PLATFORMS.length === 0) {
    console.error(' [config] no platforms defined in config, exiting', config);
    throw new Error('no platforms defined in config (PLATFORMS)');
  }

  if (!config.HOST) {
    config.HOST = {};
  }
  config.HOST.ENABLE_TLS = config.HOST.ENABLE_TLS || false;
  config.HOST.TLS_CERTS_DIR = config.HOST.TLS_CERTS_DIR || '';
  config.HOST.PORT = config.HOST.PORT || 10550;
  config.HOST.MY_PLATFORMS = config.HOST.MY_PLATFORMS || config.PLATFORMS;
  config.HOST.SETUID = config.HOST.SETUID || 99;

  if (!config.PUBLIC) {
    config.PUBLIC = {};
  }
  config.PUBLIC.DOMAIN = config.PUBLIC.DOMAIN || 'localhost';
  config.PUBLIC.PORT = config.PUBLIC.PORT || config.HOST.PORT;
  config.PUBLIC.PATH = config.PUBLIC.PATH || '/';
  config.PUBLIC.TLS = config.PUBLIC.TLS || config.HOST.ENABLE_TLS;
  config.PUBLIC.EXAMPLES_PATH = config.PUBLIC.EXAMPLES_PATH || '/examples';

  if (!config.EXAMPLES) {
    config.EXAMPLES = {};
  }
  config.EXAMPLES.ENABLE = config.EXAMPLES.ENABLE || true;
  config.EXAMPLES.SECRET = config.EXAMPLES.SECRET || '1234567890';
  config.EXAMPLES.LOCATION = config.EXAMPLES.LOCATION || './examples';


  for (var i = 0, len = config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
    if (config.HOST.MY_PLATFORMS[i] === 'dispatcher') {
      config.HOST.INIT_DISPATCHER = true;
    } else if ((config.NUM_WORKERS > 0) && (typeof config.HOST.INIT_LISTENER === 'undefined')) {
      config.HOST.INIT_LISTENER = true; // we are responsible for at least
                                        // one listener
    }
  }
  if (typeof config.HOST.INIT_LISTENER === 'undefined') {
    config.HOST.INIT_LISTENER = false;
  }

  return config;
}
var config;
module.exports = function (p1, p2, c) {
  if (!config) {
    config = ConfigLoader(p1, p2, c);
  }
  return config;
};
