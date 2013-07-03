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

var redis = require('redis');
var EventEmitter = require('events').EventEmitter;
var util = require('./util.js');
var curry = require('curry');
var responseCallbackCalled = false;

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
 *
 * Parameters:
 *
 *   platform    - string - platform name
 *   sockethubId - string/number - id of sockethub session
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
  var channel = 'sockethub:' + sockethubId + ':subsystem';
  var client2 = redis.createClient();
  var did = ' [subsystem:' + platform + '] ';
  var events = new EventEmitter();

  var objData = {
    ping: {
      verb: 'ping',
      actor: {
        platform: platform
      },
      object: {
        timestamp: ''
      },
      target: []
    }
  };


  function responseCallback(verb, targetPlatform, object) {
    console.info(did + 'sending ' + verb + ' reply to ' +
               targetPlatform);
    var resp = objData[verb];
    resp.status = true;
    resp.target = [{
      platform: targetPlatform
    }];
    if (typeof object === 'object') {
      resp.object = object;
    }
    resp.object.timestamp = new Date().getTime();
    responseCallbackCalled = true;
    //console.log('RESP OBJ: '+JSON.stringify(resp));
    client2.publish(channel, JSON.stringify(resp));
  }

  events.on('error', function (e) {
    throw new Error(did + ' events.on.error event: ' + e);
  });

  // This function handles subscribing to the subsystem channel, listening for the
  // ping event with the enckey for this sockethub instance. The encKey is used
  // to encrypt and decrypt all data stored in redis (also handled in this module).
  (function initListen() {
    var client = redis.createClient();

    client.on('error', function (e) {
      throw new Error(did + ' redis.on.error event: ' + e);
    });

    client.on('message', function (channel, message) {
      try {
        data = JSON.parse(message);
      } catch (e) {
        console.error(did + 'subsystem error with redis result: '+ e);
        throw new Error('invalid JSON data received from redis subsystem queue');
      }

      if ((!data.verb) || (!data.actor) || (!data.actor.platform)) {
        throw new Error(did + 'data object on subsystem channel not valid '+JSON.stringify(data));
      }
      if (data.actor.platform === platform) {
        // skip your own messages
        //console.debug(did + 'skipping own message');
      } else if ((typeof data.status !== 'undefined') && (data.status)) {
        if (data.target[0].platform !== platform) {
          // skip ping responses not address to us
          //console.debug(did + 'skipping ping response not addressed to this platform');
        } else {
          // this is a ping response.
          console.info(did + 'received response to a ping from '+data.actor.platform);
          events.emit('ping-response', data);
        }
      } else if ((!data.target) || (data.target.length === 0) || (data.target[0].platform === platform)) {
        // we received a ping initiation. so we respond.
        responseCallbackCalled = false;
        events.emit('ping', data);
        events.emit('ping-with-callback', data, curry(['ping',data.actor.platform], responseCallback));

        setTimeout(function () {
          if (responseCallbackCalled) {
            return;
          }
          console.warn(did + 'callback never executed, responding to ping directly');
          responseCallback('ping', data.actor.platform);
        }, 1000);
      }
    });
    client.subscribe(channel);
  })();

  function send(command, object, targetPlatform) {
    var sendObj;
    try {
      sendObj = objData[command];
    } catch (e) {
      throw new Error(did + e);
    }
    sendObj.object = object;

    if (targetPlatform) {
      sendObj.target = [{
        platform: targetPlatform
      }];
      console.info(did + 'broadcasting ping to '+targetPlatform+' on '+channel);
    } else {
      console.info(did + 'broadcasting global ping on '+channel);
    }
    client2.publish(channel, JSON.stringify(sendObj));
  }

  console.info(did + 'subsystem initalized');
  return {
    events: events,
    send: send
  };
};

module.exports = Subsystem;