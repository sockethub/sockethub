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
var Iconv = require('iconv').Iconv;

var RSS = function () {
  var pub = {};
  var session = {};

  pub.schema = {};

  function fetchFeed(url, errorObj, successObj) {
    var promise = promising();
    var iconv = new Iconv('latin1', 'utf-8');

    session.log('issuing request for ' + url);

    try {
      request(url)

      .on('error', function (e) {
        session.log('[on] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
        errorObj.target[0] = { address: url};
        errorObj.message = e.toString();
        session.send(errorObj);
      })

      .pip(iconv)

      .pipe(new FeedParser())

      .on('error', function (e) {
        session.log('[on] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
        errorObj.target[0] = { address: url};
        errorObj.message = e.toString();
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
      })

      .on('end', function () {
        promise.fulfill();
      });

    } catch (e) {
      session.log('[try] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
      errorObj.target[0] = { address: url};
      errorObj.message = e.toString();
      session.send(errorObj);
      promise.reject('failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
    }
    return promise;
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
      promise.reject('no target specified');
      return promise;
    }
    if (typeof job.target[0] === 'undefined') {
      promise.reject('invalid target array');
      return promise;
    }
    if (typeof job.target[0].address === 'undefined') {
      promise.reject('no address found in first target object');
      return promise;
    }


    var errorObj = { // preset obj for failed fetches
      verb: 'fetch',
      actor: {
        address: job.actor.addres
      },
      target: [],
      status: false,
      message: ''
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

    if (job.target.length > 1) {
      promise.reject('currently only accepting one feed per request');
    } else {
      // for now, we just will be accepting one feed per request
      fetchFeed(job.target[0].address, errorObj, successObj).then(function () {
        promise.fulfill();
      }, function (err) {
        promise.reject(err);
      });
    }
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
