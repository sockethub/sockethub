(function (window, document, undefined) {

  function SockethubClient() {}

  function Connection(sock, host, enablePings, confirmationTimeout) {
    this.sock = sock;
    this.cfg = {
      host: host,
      enablePings:  enablePings,
      confirmationTimeout: confirmationTimeout
    };
    this.state = {
      isRegistered: false,
      isConnected: true,
      pausePing: true
    };
    this.counter = 0; // rid counter
    this.callbacks = {
      message: function () {},
      response: function () {},
      error: function () {},
      close: function () {}
    };
    var cmds = {};

    this.assertConnected = function assertConnected() {
      if(typeof(sock) === 'undefined') {
        throw new Error("You need to connect sockethub before sending anything!");
      }
    };

    this.lookupVerb = function lookupVerb(rid) {
      if (typeof cmds[rid] !== 'undefined') {
        return cmds[rid].sendObject.verb;
      }
      return '';
    };

    this.log = function log(type, rid, message) {
      var verb = '';
      if (rid) {
        verb = ':' + this.lookupVerb(rid);
      }
      if (type === 1) {
        console.log('  [sockethub'+verb+'] info    - '+message);
      } else if (type === 2) {
        console.log('  [sockethub'+verb+'] success - '+message);
      } else if (type === 3) {
        console.log('  [sockethub'+verb+'] error   - '+message);
      } else if (type === 4) {
        console.log('  [sockethub'+verb+'] debug   - '+message);
      }
    };

    function finishCommand(rid, result, message) {
      if (typeof cmds[rid] !== 'object') {
        throw ('finishCommand() - unable to find command object for rid '+rid);
      }

      cmd = cmds[rid];
      delete cmds[rid];
      var p = cmd.promise;
      delete cmd.promise;

      if (result) {
        p.fulfill();
      } else {
        p.reject(message);
      }
    }

    function confirmCommand(rid, result, message) {
      if (typeof cmds[rid] !== 'object') {
        throw ('finishCommand() - unable to find command object for rid '+rid);
      }

      if (!result) {
        finishCommand(rid. result, message);
      } else {
        cmds[rid].confirmed = new Date().getTime();
      }
      //console.log('CMDS:', cmds);
    }
    var _this = this;

    function respondCommand(data) {
      if (typeof cmds[data.rid] !== 'object') {
        console.log('CMDS: ', cmds);
        throw ('respondCommand() - unable to find command object for rid '+data.rid);
      }
      var now = new Date().getTime();
      cmds[data.rid].response = now;
      var cmd = cmds[data.rid];

      if (typeof cmd.promise === "object") { // response with promise callback

        if ((typeof data.status !== "undefined") &&
            (data.status === false)) {
          // the response to a command came back as a failure.
          cmd.log(3, "rejecting promise");
          if (!cmd['confirmed']) {
            // sometimes we get a rejection before the confirm, in which case
            // we need to make sure we set received so that our verification
            // checks know to stop
            cmd['confirmed'] = now;
          }
          cmd.promise.reject(data);
        } else {
          // response is a success
          if (data.verb === 'register') {
            _this.state.isRegistered = true;
            cmd.log(4, 'register object: ' + JSON.stringify(data));
          }
          cmd.log(2, "fulfilling promise");
          cmd.promise.fulfill(data);
        }
      } else {  // response without callback, send to handler
        cmd.log(2, "issuing 'response' callback");
        _this.callbacks.response(data);
      }
    }


    //
    // as far as we know, we're now connected, we can use the 'sock' object
    // to set our handler functions.
    //
    sock.onopen = function () {
      _this.log(4, null, 'onopen fired');
      _this.state.isConnected = true;
    };

    sock.onclose = function () {
      _this.log(4, null, 'onclose fired');
      _this.state.pausePing = true;
      _this.state.isConnected = false;
      _this.state.isRegistered = false;
      _this.callbacks.close();
    };

    sock.onmessage = function (e) {
      console.log(' ');
      _this.log(4, null, 'onmessage fired ', e.data);
      //console.log('onmessage fired ', e.data);

      var data = JSON.parse(e.data);
      var now = new Date().getTime();

      if (data.verb === 'confirm') {
        _this.log(4, data.rid, 'confirmation receipt received. for rid '+data.rid);// + e.data);
        confirmCommand(data.rid, true);
      } else {
        // now we know that this object is either a response (has an RID) or
        // a message (new messages from sockethub)
        if (typeof data.rid === 'undefined') { // message
          _this.log(2, data.rid, e.data);
          _this.callbacks.message(data);
          return;
        }

        respondCommand(data);
      }
    };




    /**
     * Function: Command
     *
     * the command object handles the statefull information and functions related
     * to a single command sent to sockethub (and it's return state/completion)
     *
     * Parameters:
     *
     *   p - the AS object to send, sans RID
     *
     * Returns:
     *
     *   return Command object
     */
    function Command(p) {
      this.sent = null;
      this.confirmed = null;
      this.confirmTimeout = _this.cfg.confirmationTimeout;
      this.response = null;
      this.responseTimeout = 5000;
      this.promise = promising();

      this.sendObject = {
        rid: ++_this.counter,
        platform: p.platform,
        verb: p.verb
      };

      if (typeof p.actor) {
        this.sendObject.actor = p.actor;
      }
      if (typeof p.target) {
        this.sendObject.target = p.target;
      }
      if (typeof p.object) {
        this.sendObject.object = p.object;
      }
    }
    Command.prototype = {
      constructor: Command,
      getRID: function () {
        return this.sendObject.rid;
      },
      log: function (type, message) {
        _this.log(type, this.getRID(), message);
      },
      /**
       * Function: sendObject
       *
       * Send given object, storing a promise of the call
       *
       * Returns a promise, which will be fulfilled with the first response carrying
       * the same 'rid'.
       */
      send: function () {
        var json_o = JSON.stringify(this.sendObject);
        //this.log(1, 'submitting: '+json_o);
        var __this = this;
        function __sendAttempt() {
          __this.sent = new Date().getTime();
          sock.send(json_o);
          setTimeout(function () {
            __this.log(4, "checking confirmation status for rid:"+__this.getRID());
            if (!__this.confirmed) {
              __this.log(3, "confirmation not received after "+__this.confirmTimeout+'ms, sending again.');
              __sendAttempt();
            } else {
              __this.log(2, "confirmation received");
              __this.log(4, 'setting responseTimeout '+__this.responseTimeout+'ms');
              setTimeout(function () {
                if (!__this.response) {
                  __this.log(3, 'response not received, rejecting promise');
                  finishCommand(__this.getRID(), false, 'response timed out');
                } else {
                  __this.log(2, 'response received');

                }
              }, __this.responseTimeout);
            }
          }, __this.confirmTimeout);
        }
        __sendAttempt();
        return this.promise;
      }
    };

    this.createCommand = function (o) {
      var cmd = new Command(o);
      cmds[cmd.getRID()] = cmd;
      return cmd;
    };
  }

  Connection.prototype.on = function (type, callback) {
    if ((typeof this.callbacks[type] !== 'undefined') &&
        (typeof callback === 'function')) {
      this.callbacks[type] = callback;
    } else {
      console.log('invalid callback function or type name: ' + type);
    }
  };

  Connection.prototype.reconnect = function () {
    this.state.pausePing = true;
    this.state.isConnected = false;
    this.state.isRegistered = false;
    setTimeout(function () {
      this.sock.close();
      setTimeout(function () {
        this.connect(cfg);
      }, 0);
    }, 0);
  };

  Connection.prototype.isConnected = function () {
    return this.state.isConnected;
  };

  Connection.prototype.isRegistered = function () {
    return this.state.isRegistered;
  };

  /**
   * Function: togglePings
   *
   * toggles pausing of pings, returns value of pause status
   *
   * Returns:
   *
   *   return
   *     true  - pings are paused
   *     false - pings are active
   */
  Connection.prototype.togglePings = function () {
    this.state.pausePing = (this.state.pausePing) ? false : true;
    return this.state.pausePing;
  };


  /**
   * Function: register
   *
   * register client with sockethub server
   *
   * Parameters:
   *
   *   data - data to be used as the object property
   *       The value of the object area of the JSON.
   *
   * Returns:
   *
   *   return promise
   */
  Connection.prototype.register = function (data) {
    this.log(4, null, 'sockethub.register called');
    this.assertConnected();

    var obj = this.createCommand({
      platform: "dispatcher",
      verb: "register",
      object: data
    });
    console.log('OBJ:', obj);
    return obj.send();
  };

  /**
   * Function: set
   *
   * Issue the set command to a platform
   *
   * Parameters:
   *
   *   platform - the platform to send the set command to
   *   data     - the data to be contained in the 'object' propery
   *
   */
  Connection.prototype.set = function (platform, data) {
    this.assertConnected();
    var obj = this.createCommand({
      platform: "dispatcher",
      verb: "set",
      target: { platform: platform },
      object: data
    });
    return obj.send();
  };

  /**
   * Function: submit
   *
   * submit any message to sockethub, providing the entire object (except RID)
   *
   * Parameters:
   *
   *   o - the entire message (including actor, object, target), but NOT including RID
   *   timeout - (optional) - the time in milliseconds to allow for a response, fails otherwise
   *
   */
  Connection.prototype.submit = function (o, timeout) {
    this.assertConnected();
    if (typeof o.verb === "undefined") {
      this.log(3, null, "verb must be specified in object");
      throw "verb must be specified in object";
    }

    var obj = this.createCommand(o);
    if (timeout) {
      obj.responseTimeout = timeout;
    }
    return obj.send();
  };





  SockethubClient.prototype.connect = function (o) {
    var promise = promising();
    var isConnecting = true;

    // read and verify configuration
    if (typeof o !== 'object') {
      promise.reject('connection object not received');
      return promise;
    }

    if (typeof o.host === 'undefined') {
      //log(3, null, "sockethub.connect requires an object parameter with a 'host' property", o);
      console.log(" [SockethubClient] sockethub.connect requires an object parameter with a 'host' property", o);
      promise.reject("sockethub.connect requires an object parameter with a 'host' property");
      return promise;
    }

    if (typeof o.confirmationTimeout !== 'undefined') {
      o.confirmationTimeout = 4000;
    }

    if (typeof o.enablePings !== 'undefined') {
      o.enablePings = true;
    }

    //log(1, null, 'attempting to connect to ' + o.host);
    console.log(' [SockethubClient] attempting to connect to ' + o.host);

    try {
      sock = new WebSocket(o.host, 'sockethub');
    } catch (e) {
      //log(3, null, 'error connecting to sockethub: ' + e);
      console.log(' [SockethubClient] error connecting to sockethub: ' + e);
      promise.reject('error connecting to sockethub: ' + e);
    }

    if (!sock) {
      return promise;
    }

    sock.onopen = function () {
      console.log(' [SockethubClient] onopen fired');
      if (isConnecting) {
        isConnecting = false;
        var connection = new Connection(sock, o.host, o.enablePings, o.confirmationTimeout);
        promise.fulfill(connection);
      }
    };

    sock.onclose = function () {
      console.log(' [SockethubClient] onclose fired');
      if (isConnecting) {
        isConnecting = false;
        promise.reject("Unable to connect to sockethub at "+o.host);
      }
    };

    return promise;
  };


  //console.log('SockethubClient: ',SockethubClient.prototype);
  window.SockethubClient = new SockethubClient();

})(window, document);
