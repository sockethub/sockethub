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

function findObjectTypeError(AS, error) {
  let msg = "";
  for (let prop of ['object', 'actor', 'target']) {
    // if the base instancepath and AS type match, use that error
    if (error.instancePath.startsWith(`/${prop}`) &&
      error.schemaPath.startsWith(`#/definitions/type/${AS[prop]?.type}`)) {
      msg = parseMsg(error);
    }
  }
  return msg;
}

function composeFinalError(error) {
  // if we have yet to build an error message, assume this is an invalid type value (oneOf),
  // try to build a list of valid types
  let msg = "";
  if (error.keyword === 'oneOf') {
    msg = `${error.instancePath}: ${error.message}: ` +
      `${Object.keys(objectTypes).join(', ')}`;
  } else {
    msg = `activity stream: ${error.message}`;
  }
  return msg;
}

module.exports = {
  getErrorMessage: function (AS, errors) {
    let msg = "",
        i = 0;
    while (!msg && errors[i]) {
      const error = errors[i];
      msg = findObjectTypeError(AS, error);
      i += 1;
    }

    if (!msg) {
      msg = composeFinalError(errors[errors.length - 1]);
    }
    return msg;
  }
};