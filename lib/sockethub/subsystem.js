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

if (typeof(redis) !== 'object') {
  redis = require('redis');
}
var EventEmitter = require('events').EventEmitter;
var curry = require('curry');

/**
 * Function: Subsystem
 *
 * Handles the subscribing and listening to the redis pub/sub channel for
 * this sockethub instance. Used by the session class to abstract the redis
 * specific code.
 *
 * When a ping is received from any listener or dispatcher, this class will
 * determine if the ping is targeted at it (either implicity or explicity) and
 * if so, will emit an event. Possible events to hook into:
 *
 * 'ping' : Will emit when this platform using this session instance receives a
 *          ping. the parameter passed is the data object received. Ping response
 *          is handled automatically by the subsystem class.
 *
 * 'ping-with-callback' : Same as above, except the second parameter is the
 *          callback. If the callback is not called, there is never a ping
 *          response.
 *
 * 'ping-response' : Triggered when a platform receives a response to their
 *          ping. Param is data received. There is no response to this event.
 *
 * 'cleanup' : Triggered when a platforms receives a cleanup command issued
 *             by the dispatchers subsystem.
 *
 *
 * Parameters:
 *
 *   platform    - string - platform name
 *   sockethubId - string/number - id of sockethub session
 *
 *
 * Returns:
 *
 *   events : an instance of the emitter class. Use this to register 'on'
 *            events.
 *
 *            subsystem.events.on('ping', function(data) { ... });
 *
 *   send : used to send a command (currently only ping supported), second param
 *          is object data.
 *
 *          subsystem.send('ping', {encKey: 'foobar'});
 *
 *
 */
var Subsystem = function (platform, sockethubId) {
  this.platform = platform;
  this.sockethubId = sockethubId;
  this.channel = 'sockethub:' + this.sockethubId + ':subsystem';
  this.did = ' [subsystem:' + this.platform + '] ';
  this.events = new EventEmitter();
  // this.events.on('newListener', function (event, listener) {
  //   console.log('NEW LISTENER for ' + event + ': ', listener);
  // });
  this.events.setMaxListeners(4);

  this.objData = {
    ping: {
      verb: 'ping',
      actor: {
        platform: this.platform
      },
      object: {
        timestamp: ''
      },
      target: []
    },
    cleanup: {
      verb: 'cleanup',
      actor: {
        platform: this.platform
      },
      object: {
        timestamp: '',
        sids: []
      },
      target: []
    }
  };
  var responseCallbackCalled = false;

  // This section handles subscribing to the subsystem channel, listening for the
  // ping event with the enckey for this sockethub instance. The encKey is used
  // to encrypt and decrypt all data stored in redis (also handled in this module).
  this.client = redis.createClient();

  var self = this;
  this.events.on('error', function (e) {
    throw new Error(self.did + ' events.on.error event: ' + e);
  });

  this.client.on('message', function (channel, message) {
    //console.debug('MESSAGE [' + this.platform + ']: ', message);
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error(self.did + 'subsystem error with redis result: '+ e, message);
      //throw new Error('invalid JSON data received from redis subsystem queue '+e);
      return;
    }

    if ((!data.verb) || (!data.actor) || (!data.actor.platform)) {
      console.error(self.did + 'data object on subsystem channel not valid ' + JSON.stringify(data));
      return;
    } else if (data.actor.platform === self.platform) {
      // skip your own messages
      //console.debug(self.did + 'skipping own message');
      //return;
    } else if (data.verb === 'ping') {
      if ((typeof data.status !== 'undefined') && (data.status)) {
        if (data.target[0].platform !== self.platform) {
          // skip ping responses not address to us
          //console.debug(self.did + 'skipping ping response not addressed to this platform');
        } else {
          // this is a ping response.
          console.debug(self.did + 'received ping-response from ' + data.actor.platform);
          self.events.emit('ping-response', data);
        }
      } else if ((!data.target) ||
                 (data.target.length === 0) ||
                 (data.target[0].platform === self.platform)) {
        // we received a ping. so we respond.
        responseCallbackCalled = false;
        //console.log('emitting ping and ping-with-callback:', data);
        self.events.emit('ping', data);
        self.events.emit('ping-with-callback', data, curry(['ping', data.actor.platform], responseCallback));

        setTimeout(function () {
          if (responseCallbackCalled) {
            return;
          }
          console.error(self.did + 'callback never executed, responding to ping directly');
          responseCallback('ping', data.actor.platform);
        }, 1000);
      }
    } else if (data.verb === 'cleanup') {
      if ((!data.target) ||
          (data.target.length === 0) ||
          (data.target[0].platform === self.platform)) {
        // we received a cleanup command
        self.events.emit('cleanup', data);
      }
    }
  });

  function responseCallback(verb, targetPlatform, object) {
    console.debug(self.did + 'sending ' + verb + ' reply to ' +
               targetPlatform);
    responseCallbackCalled = true;
    var resp = self.objData[verb];
    resp.status = true;
    resp.target = [{
      platform: targetPlatform
    }];
    if (typeof object === 'object') {
      resp.object = object;
    }
    resp.object.timestamp = new Date().getTime();

    var client2 = redis.createClient();
    client2.publish(self.channel, JSON.stringify(resp));
    try {
      client2.quit();
    } catch (e) {
      console.warn('could not quit client: '+e);
    }
  }

  console.debug(this.did + 'platform: ' + this.platform + ' subscribed to ' + this.channel);
  this.client.subscribe(this.channel);

  console.debug(this.did + 'subsystem initalized');
  return this;
};


/**
 * Function: send
 *
 * Used to broadcast a message on the subsystem channel for this instance
 *
 * Parameters:
 *
 *   command        - [string] currently only supports 'ping'
 *   object         - [object] a grouping of properties attached to the object
 *                    portion of the broadcasted ping
 *   targetPlatform - [string|optional] platform name the broadcast is
 *                    directed at. If blank, broadcast is global.
 *
 */
Subsystem.prototype.send = function (command, object, targetPlatform) {
  var sendObj;
  try {
    sendObj = this.objData[command];
  } catch (e) {
    throw new Error(this.did + e);
  }
  sendObj.object = object;
  delete sendObj.status;

  if (targetPlatform) {
    sendObj.target = [{
      platform: targetPlatform
    }];
    console.debug(this.did + 'broadcasting ' + command + ' to ' + targetPlatform + ' on ' + this.channel);
  } else {
    console.debug(this.did + 'broadcasting ' + command + ' on ' + this.channel + ' :' + JSON.stringify(object));
  }
  var client2 = redis.createClient();
  client2.publish(this.channel, JSON.stringify(sendObj));
  client2.quit();
};

Subsystem.prototype.cleanup = function () {
  if (typeof this.client.quit === 'function') {
    this.client.quit();
  }
};


var ss = {};
function SubsystemGet(platform, sockethubId) {
  if (!platform) {
    throw new Error('did not receive platform name, cannot initialize subsystem');
  }
  if (!sockethubId) {
    throw new Error('did not receive sockethubId, cannot initialize subsystem');
  }

  if ((ss[sockethubId]) && (ss[sockethubId][platform])) {
    return ss[sockethubId][platform];
  } else {
    if (!ss[sockethubId]) {
      ss[sockethubId] = {};
    }
    ss[sockethubId][platform] = new Subsystem(platform, sockethubId);
    ss[sockethubId][platform]._delete = function () {
      ss[sockethubId][platform].events.removeAllListeners();
      delete ss[sockethubId][platform];
    };
    return ss[sockethubId][platform];
  }
}
module.exports = SubsystemGet;
