const log = require('debug')('sockethub:schemas');
const Ajv = require('ajv');
const apply = require('ajv-formats-draft2019');
const ajv = new Ajv({strictTypes: false});
apply(ajv);

const o = require('./object-types');
const ActivityStream = require('./../schemas/activity-stream.js');
const ActivityObject = require('./../schemas/activity-object.js');
const schemaURL = 'https://sockethub.org/schemas/v0';

log(`registering schema ${schemaURL}/activity-stream`);
ajv.addSchema(ActivityStream, `${schemaURL}/activity-stream`);
log(`registering schema ${schemaURL}/activity-object`);
ajv.addSchema(ActivityObject, `${schemaURL}/activity-object`);

function parseMsg(error) {
  let msg = `${error.instancePath}: ${error.message}`;
  if (error.keyword === 'additionalProperties') {
    msg += `: ${error.params.additionalProperty}`;
  } else if (error.keyword === 'enum') {
    msg += `: ${error.params.allowedValues.join(', ')}`;
  }
  return msg;
}

function getErrorMessage(AS, errors) {
  let msg = "", i = 0;
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
      `${Object.keys(o.objectTypes).join(', ')}`;
  } else {
    msg = `${error.instancePath ?
      error.instancePath : 'activity stream'}: ${error.message}`;
  }
  return msg;
}

function validateActivityObject(msg) {
  return handleValidation(ajv.getSchema(
    `${schemaURL}/activity-object`), msg, true);
}

function validateActivityStream(msg) {
  return handleValidation(ajv.getSchema(`${schemaURL}/activity-stream`), msg);
}

function validateCredentials(msg) {
  if (msg.type !== 'credentials') {
    return 'credential activity streams must have credentials set as type';
  }
  return handleValidation(ajv.getSchema(
    `${schemaURL}/context/${msg.context}/credentials`), msg);
}

function handleValidation(validator, msg, isObject=false) {
  let result = "";
  if (isObject) {
    result = validator({ object: msg });
  } else {
    result = validator(msg);
  }
  if (! result) {
    return getErrorMessage(msg, validator.errors);
  }
  return "";
}

function addPlatformSchema(schema, platform_type) {
  log(`registering schema ${schemaURL}/context/${platform_type}`);
  ajv.addSchema(schema, `${schemaURL}/context/${platform_type}`);
}

module.exports = {
  addPlatformSchema,
  validateCredentials,
  validateActivityObject,
  validateActivityStream
};