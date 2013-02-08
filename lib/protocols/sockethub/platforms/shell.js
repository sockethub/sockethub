if(!childProcess) {
    childProcess = require('child_process');
}
var promising = require('promising');

module.exports = {
  execute: function(job, session) {
    var promise = promising();
    childProcess.exec(job.object.text, function (err, stdout, stderr) { 
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
};
