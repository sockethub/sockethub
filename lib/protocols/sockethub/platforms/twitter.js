
var twitter = require('ntwitter'),
  promising = require('promising');

module.exports = {
  post: function(job, session) {
    //console.log(job);
    //console.log(session);
    //die();
    var twit = new twitter({
      consumer_key: session.config.twitterConsumerKey,
      consumer_secret: session.config.twitterConsumerSecret,
      access_token_key: session.config.twitterAccessToken,
      access_token_secret: session.config.twitterAccessTokenSecret
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
  }
};
