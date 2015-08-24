/**
 * Function: assertType
 *
 * used to assert that a variable is of a specified type
 *
 * Parameters:
 *
 *   data - the variable to test
 *   type - the type the variable should be checked against (function, object, etc)
 *
 * Returns:
 *
 *   return boolean
 */
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function (undefined) {
  var pub = {};
  var _msg;
  pub.assertType = function (data, type, customMsg) {
    customMsg = customMsg ? (' -- ' + customMsg) : '';
    var args = Array.prototype.slice.call(arguments);
    var self = arguments.callee;
    if ((type === 'array') &&
        (Array.isArray(data))) {
        return true;
    } else if (typeof data === type) {
      return true;
    } else {
      self.msg = "property of type: '" + typeof data + "' not equal to type: '" + type + "'" + customMsg;
      _msg = self.msg;
      return false;
    }
  };
  pub.assertTypeHandler = function (obj, type, customMsg) {
    var status = false;
    var msg;
    if (this._assertType(obj, type, customMsg)) {
      status = true;
    } else {
      msg = this._assertType.msg;
      status = false;
    }
    msg = (msg) ? msg : (_msg) ? _msg : customMsg;
    this.result(status, msg);
    return status;
  };
  pub.assertTypeFailHandler = function (obj, type, customMsg) {
    var status = false;
    var msg;
    if (this._assertType(obj, type, customMsg)) {
      status = false;
    } else {
      msg = this._assertType.msg;
      status = true;
    }
    msg = (msg) ? msg : (_msg) ? _msg : customMsg;
    this.result(status, msg);
    return status;
  };
  pub.assertTypeAndHandler = function (obj, type, customMsg) {
    var status = false;
    var msg ;
    if (this._assertType(obj, type, customMsg)) {
      status = true;
    } else {
      msg = this._assertType.msg;
      status = false;
      msg = (msg) ? msg : (_msg) ? _msg : customMsg;
      this.result(false, msg);
    }
    return status;
  };
  pub.assertTypeFailAndHandler = function (obj, type, customMsg) {
    var status = false;
    var msg ;
    if (this._assertType(obj, type, customMsg)) {
      status = false;
      msg = (msg) ? msg : (_msg) ? _msg : customMsg;
      this.result(false, msg);
    } else {
      msg = this._assertType.msg;
      status = true;
    }
    return status;
  };

  pub.assertType.msg = '';
  return pub;
});
