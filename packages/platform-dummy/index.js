class Dummy {
  constructor(cfg) {
    cfg = (typeof cfg === 'object') ? cfg : {};
    this.id = cfg.id;
    this.debug = cfg.debug;
    this.sendToClient = cfg.sendToClient;
  }

  get schema() {
    return {
      name: "dummy",
      version: require('./package.json').version,
      messages: {
        "required": ["type"],
        "properties": {
          "type": {
            "enum": ["echo", "fail", "respond"]
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
  }

  echo(job, cb) {
    this.sendToClient(job);
    cb();
  }

  fail(job, cb) {
    cb(new Error(job.object.content));
  }

  respond(job, cb) {
    cb(job.object.content);
  }

  cleanup(cb) {
    cb();
  }
}

module.exports = Dummy;
