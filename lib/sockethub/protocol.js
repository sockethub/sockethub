/**
 * This file is part of sockethub.
 *
 * copyright 2012-2013 Nick Jennings (https://github.com/silverbucket)
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

var verbs = require('./../schemas/verbs.js');
var platforms = require('./../schemas/platforms.js');
var JSVlib = require('JSV').JSV; // json schema validator

// normalize the verbs.
// 1. ensure all verbs have a name attribute
function normalizeVerbs(v) {
  for (var k in v) {
    if (typeof v[k].name === 'undefined') {
      v[k].name = k;
    }
  }
  return v;
}

// normalize the platforms schemas.
// 1. ensure all platforms have a name attribute
// 2. switch verb list array to a series of
//    objects with a name property
function normalizePlatforms(p) {
  for (var k in p) {
    if (typeof p[k].name === 'undefined') {
      p[k].name = k;
    }

    if (typeof p[k].verbs[0] !== 'undefined') {
      // verbs list is an array. convert to objects with the name property
      var verbList = p[k].verbs;
      delete p[k].verbs;
      p[k].verbs = {};
      for (var i = 0, n = verbList.length; i < n; i = i +1) {
        p[k].verbs[verbList[i]] = {
          name: verbList[i]
        };
      }
    } else if (typeof p[k].verbs !== 'undefined') {
      // verbs list is already a series of objects.
      // ensure they have the name property.
      for (var k2 in p[k].verbs) {
        if (p[k].verbs[k2].name === 'undefined') {
          p[k].verbs[k2].name = k2;
        }
      }
    }
  }
  return p;
}

try {
  verbs = normalizeVerbs(verbs);
} catch (e) {
  throw new Error(" [protocol] error in lib/schemas/verbs.js : "+e);
}
try {
  platforms = normalizePlatforms(platforms);
} catch (e) {
  throw new Error(" [protocol] error in lib/schemas/platforms.js : "+e);
}

var lverbs, lplatforms;
try {
  lverbs = require('./../schemas/verbs.local.js');
  console.debug(' [protocol] loaded lib/schemas/verbs.local.js');
  lverbs = normalizeVerbs(lverbs);

} catch (e) {
  console.debug(" [protocol] skipping lib/schemas/verbs.local.js");
}
try {
  lplatforms = require('./../schemas/platforms.local.js');
  console.debug(' [protocol] loaded lib/schemas/platforms.local.js');
  lplatforms = normalizePlatforms(lplatforms);
} catch (e) {
  console.debug(" [protocol] skipping lib/schemas/platforms.local.js");
}


// merge properties from local platforms and verbs to master list
for (var k in lplatforms) {
  if (platforms[k]) {
    throw new Error('entry in platforms.local.js invalid: '+k+' already defined');
  } else {
    platforms[k] = lplatforms[k];
  }
}
for (var k in lverbs) {
  if (verbs[k]) {
    throw new Error('entry in verbs.local.js invalid: '+k+' already defined');
  } else {
    verbs[k] = lverbs[k];
  }
}


var functions = (function() {
  var pub = {};

  pub.ping = function (d, session, resp) {
    var response = {};
    if (typeof d.timestamp !== 'undefined') {
      response.timestamp = d.timestamp;
    } else {
      response = 'invalid json';
    }
    resp(null, response);
  };

  pub.register = function (job, session, resp) {
    // some 'secret' handling
    // load the secret file, and check for a valid
    // match.
    console.debug(' [dispatcher] received register request');
    if (typeof job.object.secret === 'string') {
      var config = require('./config-loader.js').get();
      if (typeof config.SECRETS !== 'object') {
        console.error(' [protocol] config.SECRETS not loaded, cannot verify secret', config);
        resp('registration failed, secret cannot be verified.');
      }

      for (var i = 0, num = config.SECRETS.length; i < num; i = i + 1) {
        if (config.SECRETS[i] === job.object.secret) {
          session.register(config.SECRETS[i]);
          if (job.object.remoteStorage) {
            session.setConfig('remoteStorage', job.object.remoteStorage);
          }
          resp(null, {sessionId: ""+session.getSessionID()});
          return;
        }
      }
    } else {
      resp('unable to register connection, no secret provided.');
    }
    resp('registration failed, invalid secret.');
  };

  pub.set = function (job, session, resp) {
    // validate job.object against the platforms schema
    var platform;
    try {
      platform = require('./../platforms/'+job.target.platform)();
    } catch (e) {
      resp('unable to load platform '+job.target.platform);
      return;
    }

    if ((typeof platform.schema === 'object') && (typeof platform.schema.set === 'object')) {
      var JSVlib = require('JSV').JSV; // json schema validator
      var jsv = JSVlib.createEnvironment();
      var report = jsv.validate(job.object, platform.schema.set);
      if (report.errors.length !== 0) {  // protocol.js json errors
        resp('invalid object format ' + JSON.stringify(report.errors));
        return;
      } else {
        console.debug(' [dispatcher:set] job.object schema validated ');//, report);
      }
    } else {
      resp('platform has to have a schema defined for set operations. cannot validate request');
      return;
    }


    // set the value of object into a redis session DB
    session.getPlatformSession(job.target.platform).then(function (psession) {
      var keys = Object.keys(job.object);
      for (var i = 0, num = keys.length; i < num; i = i + 1) {
        if (keys[i] === '@type') { continue; }
        console.info(' [dispatcher:set] setting config for platform [' +
                     job.target.platform + '] key ['+keys[i]+']');
        psession.setConfig(keys[i], job.object[keys[i]]).then(function () {
          resp(null);
        }, function (err) {
          resp(err);
        });
      }
    });

  };

  return pub;
}());


// note that you only specify a function in the platforms->[platform]->[verb] area
// if he platform does not have an actual platform file. This is mostly only used for
// minor, internal, helper functions or dispatcher related functions like register or ping.
// ** platform developers should not be adding "func" properties.
platforms['dispatcher'] = {
  "name" : "dispatcher",
  "local" : true,
  "verbs" : {
    "ping": {
      "name" : "ping",
      "func" : functions.ping // if func is set, we dont send to redis queue
    },
    "register" : {
      "name" : "register",
      "func" : functions.register
    },
    "set" : {
      "name" : "set",
      "func" : functions.set
    }
  }
};

var proto = {
  platforms: platforms,
  verbs: verbs
};

// validate everything before sending it back
try {
  baseSchema = require("./../schemas/base.js");
} catch (e) {
  throw new Error('unable to load lib/schemas/base.js ' + e, true);
}

// validate that the protocol.js has the correct format for defining all verbs
// and platforms with their associated verbs.
var jsv = JSVlib.createEnvironment();
var report = jsv.validate(proto, baseSchema);
if (report.errors.length !== 0) {  // protocol.js json errors
  throw new Error('invalid format in lib/sockethub/protocol.js (which includes lib/sockethub/platform.js & verbs.js): '+
        JSON.stringify(report.errors), true);
} else {
  console.debug(' [protocol] lib/sockethub/protocol.js schema validated');
}

// verifying the platform sections verbs match the verbs section list, in protocol.js
for (var p in proto.platforms) {
  for (var v in proto.platforms[p].verbs) {
    if (typeof proto.verbs[v] === 'undefined') {
      throw new Error('invalid verb ' + v + ' defined in ' + p + ' platform schema [platforms.js]', true);
    }
  }
}

module.exports = proto;