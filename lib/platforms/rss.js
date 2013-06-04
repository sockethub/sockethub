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

    session.log('fetching feed from: ', job.target);
    if (typeof job.target !== 'object') {
      promise.fulfill('no target specified', false, null);
      return;
    }
    try {
      for (var key in job.target) {
        feedparser.parseUrl(job.target[key].address).on('article', function (article) {
          console.log('retreived artcile: ', article);
          var sendObj = {
            verb: 'add',
            actor: {
              name: (article.meta.title) ?
                      article.meta.title : (article.meta.link) ?
                                             article.meta.link : job.target[key].address,
              address: (article.meta.link) ? article.meta.link : job.target[key].address,
              description: (article.meta.description) ? article.meta.description : ''
            },
            target: { to: [{ address: job.actor.address}] },
            status: true,
            object: {
              title: article.title,
              date: article.data,
              tags: article.categories,
              text: '',
              html: article.summary,
              brief_text: '',
              brief_html: article.description,
              link: article.link
            }
          };
          session.send(sendObj);
        }); //.on('error', promise.reject(error));
      }
      promise.fulfill(null, true, {});
    } catch (e) {
      promise.reject(e);
    }
    return promise;
  };

  o.cleanup = function () {
    var promise = promising();
    promise.fulfill();
    return promise;
  };

  return o;
};

module.exports = RSS;