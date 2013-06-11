if (typeof(FeedParser) !== 'object') {
  FeedParser = require('feedparser');
}
if (typeof(request) !== 'object') {
  request = require('request');
}
var promising = require('promising');





var RSS = function () {
  var o = {};
  var session = {};

  o.schema = {};

  function fetchFeed(url, errorObj, successObj) {
    session.log('issuing request for '+ url);

    try {
      //request(job.target[key].addres)
      //.pipe(new FeedParser({feedurl: job.target[key].url}))
      FeedParser.parseUrl(url)
      .on('article', function (article) {
        console.log('retreived artcile: ', article);
        successObj.actor.name = (article.meta.title) ?
                                  article.meta.title : (article.meta.link) ?
                                    article.meta.link : url,
        successObj.actor.address = url; //(article.meta.link) ? article.meta.link : url;
        successObj.actor.description = (article.meta.description) ? article.meta.description : '';
        successObj.object.title = article.title;
        successObj.object.date = article.date;
        successObj.object.tags = article.categories;
        successObj.object.text = article.summary,
        successObj.object.html = article.summary,
        successObj.object.brief_text = article.description;
        successObj.object.brief_html = article.description;
        successObj.object.link = article.link;
        session.send(successObj);
      })

      .on('error', function (e) {
        session.log('[on] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
        errorObj.target[0] = { address: url};
        errorObj.object.message = e.toString();
        session.send(errorObj);
      });

    } catch (e) {
      session.log('[try] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
      errorObj.target[0] = { address: url};
      errorObj.object.message = e.toString;
      session.send(errorObj);
    }
  }


  o.init = function (sess) {
    var promise = promising();
    session = sess;
    promise.fulfill();
    return promise;
  };

  o.fetch = function (job) {
    var promise = promising();

    if (typeof job.target !== 'object') {
      promise.fulfill('no target specified', false, null);
      return;
    }

    var errorObj = { // preset obj for failed fetches
      verb: 'fetch',
      actor: {
        address: job.actor.addres
      },
      target: [],
      status: false,
      object: {
        message: ''
      }
    };

    var successObj = { // preset obj for success fetches
      verb: 'add',
      actor: {
        name: '',
        address: '',
        description: ''
      },
      target: [{ address: job.actor.address}],
      status: true,
      object: {
        title: '',
        date: '',
        tags: '',
        text: '',
        html: '',
        brief_text: '',
        brief_html: '',
        link: ''
      }
    };

    for (var key in job.target) {
      fetchFeed(job.target[key].address, errorObj, successObj);
    }
    promise.fulfill(null, true, {});
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