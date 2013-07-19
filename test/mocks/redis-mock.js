var Redis = {
  __test: { Stub: function () {}},
  __instances: {},
  __fireEvent: function (channel, event, data) {
    console.log('__fireEvent called, instances: ', this.__instances);
    for (var key in this.__instances) {
      console.log('REDIS MOCK EVENT FIRE: ',data);
      this.__instances[key].__fireEvent(channel, event, data, key);
    }
  },
  __existsChannel: function (channel) {
    for (var key in this.__instances) {
      if (_this.__instances[key].subscribed_channels.indexOf(channel) > -1) {
        return true;
      }
    }
    return false;
  },
  __clearHandlers: function () {
    for (var key in this.__instances) {
      this.__instances[key].__clearHandlers();
      delete this.__instances[key];
    }
    this.__instances = {};
  },
  createClient: function () {
    _this = this;
    var randa = Math.floor((Math.random()*10)+1) + new Date().getTime();
    var randb = Math.floor((Math.random()*10)+2) *
                Math.floor((Math.random()*10)+3) /
                Math.floor((Math.random()*10)+4);
    var me = randa * randb / 1000;
    _this.__instances[me] = {};
    _this.__instances[me].subscribed_channels = [];
    var events = {
      'message': [],
      'error': []
    };

    _this.__instances[me].subscribe = new _this.__test.Stub(function (channel) {
      //console.log('instance['+me+'] subscribing to: '+channel);
      _this.__instances[me].subscribed_channels.push(channel);
    });

    _this.__instances[me].publish = new _this.__test.Stub(function (channel, json) {
      _this.__fireEvent(channel, 'message', json);
    });

    _this.__instances[me].on = new _this.__test.Stub(function (event, callback) {
      console.log('instance['+me+'] registering callback for \''+event+'\'');
      events[event].push(callback);
    });

    _this.__instances[me].quit = function () {
      delete _this.__instances[me];
    };

    _this.__instances[me].exists = _this.__existsChannel;

    _this.__instances[me].__fireEvent = function (channel, event, data, key) {
      if (!key) {
        key = me;
      }
      if (!_this.__instances[key]) { return; }

      if (_this.__instances[key].subscribed_channels.indexOf(channel) > -1) {
        console.log('REDIS EVENT: instance['+key+'] chan. \''+channel+'\', send: \''+event+'\': '+data);
        for (var i = 0, num = events[event].length; i < num; i = i + 1) {
          events[event][i](channel, data);
        }
      } else {
        console.log('instance['+key+'] not subscribed to channel \''+channel+'\', not firing \''+event+'\'', _this.__instances[key].subscribed_channels);
      }
    };

    _this.__instances[me].__clearHandlers = function () {
      for (var i = 0, num = events.length; i < num; i = i + 1) {
        for (var j = 0, numj = events[i].length; j < numj; j = j + 1) {
          delete events[i][j];
        }
        events[i] = {};
      }
      _this.__instances[me].subscribed_channels = [];
    };

    return _this.__instances[me];
  }
};
module.exports = function (t) {
  Redis.__test = t;
  return Redis;
};