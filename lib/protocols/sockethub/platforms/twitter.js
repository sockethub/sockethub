
var twitter = require('ntwitter'),
  promising = require('promising');

module.exports = {
  post: function(job, session) {
    try {
      console.log('got this job', job);
      console.log('got this session', session);
      session.get('sockettest', '.sockethub/.twitter').then(function(cred) {
        console.log('got these creds', cred);
        var twit = new twitter({
          consumer_key: cred.consumerKey,
          consumer_secret: cred.consumerSecret,
          access_token_key: cred.accessToken,
          access_token_secret: cred.accessTokenSecret
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
      });
    } catch(e) {
      session.send(e);
    }
  }
};
