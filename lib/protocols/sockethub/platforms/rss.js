if (typeof(feedparser) !== 'object') {
  feedparser = require('feedparser');
}
var promising = require('promising');

var RSS = function () {
  var o = {};
  var session = {};

  o.schema = {};

  o.init = function (sess) {
    var promise = promising();
    session = sess;
    promise.fulfill();
    return promise;
  };

  o.fetch = function (job) {
    var promise = promising();

    session.log('fetching feed from ', job.target);
    try {
      feedparser.parseUrl(job.target.to[0].address).on('article', function (article) {
        console.log('retreived artcile: ', article);
        var sendObj = {
            verb: 'add',
            actor: { address: job.target.to[0].address },
            target: { to: [{ address: ""}] },
            status: true,
            object: article
          };
          session.send(sendObj);
      }).on('error', function (error) {
        promise.reject(error);
      });
      promise.fulfill(null, true, {});
    } catch (e) {
      promise.reject(e);
    }
    return promise;
  };

  return o;
};

module.exports = RSS;