if(!exec) {
    exec = require('child_process').exec;
}
var promising = require('promising');

module.exports = {
  execute: function(job, session) {
    var promise = promising();
    exec(job.object.text, function (err, stdout, stderr) { 
      if(err) {
        promise.fulfill(err, {
          stdout: stdout,
          stderr: stderr
        });
      } else {
        //TODO: deal with commands that do not complete immediately
        promise.fulfill(null, {
          stdout: stdout,
          stderr: stderr
        });
      }
    });
    return promise;
  }
});
