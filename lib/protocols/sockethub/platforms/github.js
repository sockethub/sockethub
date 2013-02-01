module.exports = (function() {
  var https = require('https');

  //function getBearerToken(code, clientId, clientSecret) {
  //  https.request({
  //    hostname: 'github.com',
  //    path: '/login/oauth/access_token',
  //    method: 'POST'
  //  }, function(res) {
  //    res.on('data', function(chunk) {
  //      console.log(chunk.toString());
  //    });
  //  }).end('client_id='+clientId+'&client_secret='+clientSecret+'&code='+code);
  //}

  function post(path, data, cred) {
    var dataStr = JSON.stringify(data);
    https.request({
      hostname: 'api.github.com',
      path: path,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer '+cred.accessToken,
        'Content-Length': dataStr.length
      }
    }, function(res) {
      res.on('data', function(chunk) {
        console.log(chunk.toString());
      });
    }).end(dataStr);
  }

  return {
    create: function(job, session) {
      session.get('sockettest', '.sockethub/.github').then(function(cred) {
        post('/repos/'+job.target.owner+'/'+job.target.repo+'/issues', {
          title: job.object.title,
          body: job.object.body
        }, cred);
      });
    }
  };
})();
