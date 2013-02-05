var https = require('https');

module.exports = {
  post: function (job, session, resp) {
    var req = https.request({
      host: 'graph.facebook.com',
      path: '/me/feed',
      method: 'POST'
    }, function (res) {
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        //session.send('got chunk '+chunk); // What is this for?
      });
      res.on('end', function() {
        //session.send('response end with status '+res.status); // What is this for?
      });
    });
    req.end('message=' + encodeURIComponent(job.object.text) +
            '&access_token=' + encodeURIComponent(job.credentials.token));
    session.send(null, true);
  },
  message: function() {}
};
