
var twitter = require('ntwitter'),
  promising = require('promising');

module.exports = {
  post: function(job, session) {
    try {
      var twit = new twitter({
        consumer_key: job.credentials.consumerKey,
        consumer_secret: job.credentials.consumerSecret,
        access_token_key: job.credentials.accessToken,
        access_token_secret: job.credentials.accessTokenSecret
      });
      twit.verifyCredentials(function (err, data) {
        if (err) {
          session.send("Error verifying credentials: " + err);
        } else {
          twit.updateStatus(job.object, function (err, data) {
            if (err) {
              session.send('Tweeting failed: ' + err);
            } else {
              session.send('Success!')
            }
          });
        }
      });
    } catch(e) {
      session.send(e);
    }
  }
};
