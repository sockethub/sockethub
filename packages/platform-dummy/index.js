class Dummy {
  constructor(cfg) {
    cfg = (typeof cfg === 'object') ? cfg : {};
    this.id = cfg.id;
    this.debug = cfg.debug;
  }

  get schema() {
    return {
      name: "dummy",
      version: require('./package.json').version,
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
  }

  echo(job, cb) {
    job.target = job.actor;
    job.actor = {
      id: 'dummy',
      type: 'platform'
    };
    cb(undefined, job);
  }

  fail(job, cb) {
    cb(new Error(job.object.content));
  }

  cleanup(cb) {
    cb();
  }
}

module.exports = Dummy;
