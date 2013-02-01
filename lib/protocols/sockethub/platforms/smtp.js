module.exports = (function() {
  var mailer = require("mailer");
  return {
    message: function(job, session) {
      var obj = {
        host : job.credentials.host,
        port : "587",
        domain : job.actor.address.split('@')[1],
        to: job.target.to[0].address,
        from: job.actor.address,
        subject: job.object.subject,
        body: job.object.body,
        authentication: "login",
        username: job.credentials.user,
        password: job.credentials.password
      };
      console.log(obj);
      mailer.send(obj,
      function(err, result){
        console.log('callback');
        console.log(err);
        console.log(result);
        if(err){
          session.send(err);
        }
        session.send(result);
      });
    }
  };
})();
