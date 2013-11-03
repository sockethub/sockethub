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
var Iconv = require('iconv').Iconv;
var Q = require('q');

var RSS = function () {
  var pub = {};
  var session = {};
  var abort = false; // flagged when cleanup is called

  pub.schema = {};

  function fetchFeed(url, errorObj, successObj) {
    if (abort) {return;}
    var q = Q.defer();
    var iconv = new Iconv('latin1', 'utf-8');
    var count = 0;
    var articleLinks = [];
    var error = false;

    session.log('issuing request for ' + url);

    try {
      request(url)

      .on('error', function (e) {
        if (abort) {return;}
        session.error('[on] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
        // errorObj.target[0] = { address: url};
        // errorObj.message = e.toString();
        // session.send(errorObj);
        error = e.toString();
        q.reject(error);
      })

      .pipe(iconv)

      .pipe(new FeedParser())

      .on('error', function (e) {
        if (abort) {return;}
        session.error('[on] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
        // errorObj.target[0] = { address: url};
        // errorObj.message = e.toString();
        // session.send(errorObj);
        error = e.toString();
      })

      .on('meta', function(meta) {
        if (abort) {return;}
        session.log('received feed: ' + meta.title);
        successObj.actor.name = (meta.title) ?
                                  meta.title : (meta.link) ?
                                    meta.link : url,
        successObj.actor.address = url;
        successObj.actor.description = (meta.description) ? meta.description : '';
      })

      .on('readable', function () {
        if (abort) {return;}
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
          articleLinks.push(item.link);
          session.log('sending feed article for: ' + successObj.actor.name);
          session.send(successObj);
        }
        count = count + 1;
      })

      .on('end', function (e) {
        if (abort) {return;}
        console.log('COMPLETE',error);
        if (error) {
          console.log("ERROR");
          q.reject(error);
        } else {
          console.log("SUCCESS");
          q.resolve({
            totalArticles: count,
            articleLinks: articleLinks
          });
        }
      });

    } catch (e) {
      if (abort) {return;}
      session.log('[try] failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
      errorObj.target[0] = { address: url};
      errorObj.message = e.toString();
      session.send(errorObj);
      q.reject('failed to fetch RSS feed from url: '+ url+ ' : '+e.toString());
    }
    return q.promise;
  }


  pub.init = function (sess) {
    session = sess;
    var q = Q.defer();
    q.resolve();
    return q.promise;
  };

  pub.fetch = function (job) {
    var q = Q.defer();

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

    var jobs = 0;
    var completed = 0;
    var stats = {};
    var completedObj = {};

    function jobCompleted (url, result) {
      completed = completed + 1;
      completedObj[url] = result;
      if (jobs === completed) {
        q.resolve(completedObj);
      }
    }

    function jobFailed (url, err) {
      completed = completed + 1;
      completedObj[url] = err;
      if (jobs === completed) {
        q.reject(err, completedObj);
      }
    }

    function runJob (url) {
      fetchFeed(url, errorObj, successObj)
        .then(function (obj) {
          jobCompleted(url, obj);
        }, function (err) {
          jobFailed(url, err);
        });
    }

    if (typeof job.target !== 'object') {
      q.reject('no target specified');
    } else if (typeof job.target[0] === 'undefined') {
      q.reject('invalid target array');
    } else if (typeof job.target[0].address === 'undefined') {
      q.reject('no address found in first target object');
    } else {
      // ready to execute job

      // a job may complete before the next loop if there's an error, so
      // lets count the jobs before we process them...
      for (var i = 0, len = job.target.length; i < len; i = i + 1) {
        if (job.target[i].address) {
          jobs = jobs + 1;
        }
      }
      // now process them...
      for (i = 0, len = job.target.length; i < len; i = i + 1) {
        if (job.target[i].address) {
          runJob(job.target[i].address);
        }
      }

      var allJobsSent = true;
      if (jobs === completed) {
        q.resolve();
      }
    }

    return q.promise;
  };

  pub.cleanup = function () {
    var q = Q.defer();
    abort = true;
    q.resolve();
    return q.promise;
  };

  return pub;
};

module.exports = RSS;
