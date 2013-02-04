
var twitter = require('ntwitter'),
  promising = require('promising');

module.exports = {
  post: function(job, session) {
    try {
      var creds = {
        consumer_key: job.credentials.consumerKey,
        consumer_secret: job.credentials.consumerSecret,
        access_token_key: job.credentials.accessToken,
        access_token_secret: job.credentials.accessTokenSecret
      };
      console.log('[Twitter]', creds);
      var twit = new twitter(creds);
      twit.verifyCredentials(function (err, data) {
        if (err) {
          session.send("Error verifying credentials: " + err);
        }
      }).updateStatus(job.object.text, function (err, data) {
        if (err) {
          session.send('Tweeting failed: ' + err);
        } else {
          session.send('Success!');
        }
      });
    } catch(e) {
      session.send(e);
    }
  }
};
