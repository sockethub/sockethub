const objectTypes = require('./object-types');

function parseMsg(error) {
  let msg = `${error.instancePath}: ${error.message}`;
  if (error.keyword === 'additionalProperties') {
    msg += `: ${error.params.additionalProperty}`;
  } else if (error.keyword === 'enum') {
    msg += `: ${error.params.allowedValues.join(', ')}`;
  }
  return msg;
}

module.exports = {
  getErrorMessage: function (AS, errors) {
    let msg = "",
        i = 0;
    while (msg === "" && errors[i]) {
      const error = errors[i];
      for (let prop of ['object', 'actor', 'target']) {
        // if the base instancepath and AS type match, use that error
        if (error.instancePath.startsWith(`/${prop}`) &&
            error.schemaPath.startsWith(`#/definitions/type/${AS[prop]?.type}`)) {
          msg = parseMsg(error);
        }
      }
      i += 1;
    }

    if (msg === "") {
      // if we have yet to build an error message, assume this is an invalid type value (oneOf),
      // try to build a list of valid types
      const finalError = errors[errors.length - 1];
      if (finalError.keyword === 'oneOf') {
        msg = `${finalError.instancePath}: ${finalError.message}: ` +
          `${Object.keys(objectTypes).join(', ')}`;
      } else {
        msg = `${finalError.instancePath ? 
          finalError.instancePath : 'activity stream'}: ${finalError.message}`;
      }
    }
    return msg;
  }
}