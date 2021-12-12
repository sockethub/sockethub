const objectTypes = require('./object-types');

function parseMsg(error) {
  let msg = `${error.instancePath}: ${error.message}`;
  if (error.keyword === 'additionalProperties') {
    msg += `: ${error.params.additionalProperty}`
  } else if (error.keyword === 'enum') {
    msg += `: ${error.params.allowedValues.join(', ')}`
  }
  return msg;
}

module.exports = {
  getErrorMessage: function (AS, errors) {
    for (error of errors) {
      // if the base instancepath and AS type match, use that error
      if (error.instancePath.startsWith('/object') &&
          error.schemaPath.startsWith(`#/definitions/type/${AS.object.type}`)) {
        return parseMsg(error);
      } else if (error.instancePath.startsWith('/actor') &&
                 error.schemaPath.startsWith(`#/definitions/type/${AS.actor.type}`)) {
        return parseMsg(error);
      } else if (error.instancePath.startsWith('/target') &&
                 error.schemaPath.startsWith(`#/definitions/type/${AS.target.type}`)) {
        return parseMsg(error);
      }
    }

    if (errors.length) {
      // if no errors found so far, assume this is an invalid type value (oneOf),
      // try to build a list of valid types
      const finalError = errors[errors.length - 1];
      if (finalError.keyword === 'oneOf') {
        return `${finalError.instancePath}: ${finalError.message}: ${Object.keys(objectTypes).join(', ')}`;
      }
    }

    return "";
  }
}