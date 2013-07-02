/**
 * This file is part of sockethub.
 *
 * © 2012-2013 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the AGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of sockethub can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

if (typeof(FeedParser) !== 'object') {
  FeedParser = require('feedparser');
}
if (typeof(request) !== 'object') {
  request = require('request');
}
var promising = require('promising');


var RSS = function () {
  var pub = {};
  var session = {};

  pub.schema = {};

  function fetchFeed(url, errorObj, successObj) {
    session.log('issuing request for ' + url);

    try {
      request(url)

      .on('error', function (e) {
        session.log('[on] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
        errorObj.target[0] = { address: url};
        errorObj.object.message = e.toString();
        session.send(errorObj);
      })

      .pipe(new FeedParser({feedurl: url}))

      .on('error', function (e) {
        session.log('[on] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
        errorObj.target[0] = { address: url};
        errorObj.object.message = e.toString();
        session.send(errorObj);
      })

      .on('meta', function(meta) {
        session.log('received feed: ' + meta.title);
        successObj.actor.name = (meta.title) ?
                                  meta.title : (meta.link) ?
                                    meta.link : url,
        successObj.actor.address = url;
        successObj.actor.description = (meta.description) ? meta.description : '';
      })

      .on('readable', function () {
        var stream = this, item;
        while (item = stream.read()) {
          successObj.object.title = item.title;
          successObj.object.date = item.date;
          successObj.object.tags = item.categories;
          successObj.object.text = item.summary,
          successObj.object.html = item.summary,
          successObj.object.brief_text = item.description;
          successObj.object.brief_html = item.description;
          successObj.object.link = item.link;
          session.log('sending feed article for: ' + successObj.actor.name);
          session.send(successObj);
        }
      });

    } catch (e) {
      session.log('[try] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
      errorObj.target[0] = { address: url};
      errorObj.object.message = e.toString;
      session.send(errorObj);
    }
  }


  pub.init = function (sess) {
    var promise = promising();
    session = sess;
    promise.fulfill();
    return promise;
  };

  pub.fetch = function (job) {
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

  pub.cleanup = function () {
    var promise = promising();
    promise.fulfill();
    return promise;
  };

  return pub;
};

module.exports = RSS;