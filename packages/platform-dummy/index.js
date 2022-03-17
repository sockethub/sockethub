const packageJSON = require('./package.json');

class Dummy {
  constructor(cfg) {
    this.name = 'dummy';
    this.version = require('./package.json').version;
    cfg = (typeof cfg === 'object') ? cfg : {};
    this.id = cfg.id;
    this.debug = cfg.debug;
    this.sendToClient = cfg.sendToClient;
  }

  get schema() {
    return {
      version: packageJSON.version,
      messages: {
        "required": ["type"],
        "properties": {
          "type": {
            "enum": ["echo", "fail"]
          }
        }
      },
      credentials: {}
    };
  }

  get config() {
    return {
      persist: false,
      requireCredentials: []
    };
  };

  echo(job, cb) {
    this.sendToClient(job.object.content);
    cb();
  };

  fail(job, cb) {
    cb(new Error(job.object.content));
  };

  cleanup(cb) {
    cb();
  };
}

module.exports = Dummy;
