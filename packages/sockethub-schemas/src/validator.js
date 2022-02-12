const log = require('debug')('sockethub:schemas');
const Ajv = require('ajv');
const ajvFormat2019 = require('ajv-formats-draft2019');

const ajv = new Ajv({strictTypes: false, allErrors: true});
ajvFormat2019(ajv);

const o = require('./object-types');
const schemaURL = 'https://sockethub.org/schemas/v0';
const schemas = {};
schemas[`${schemaURL}/activity-stream`] = require('./../schemas/activity-stream.json');
schemas[`${schemaURL}/activity-object`] = require('./../schemas/activity-object.json');
const platformSchema = require('./platform');

for (let uri in schemas) {
  log(`registering schema ${uri}`);
  ajv.addSchema(schemas[uri], uri);
}

function parseMsg(error) {
  let err = `${error.instancePath ? error.instancePath : 'activity stream'}: ${error.message}`;
  if (error.keyword === 'additionalProperties') {
    err += `: ${error.params.additionalProperty}`;
  } else if (error.keyword === 'enum') {
    err += `: ${error.params.allowedValues.join(', ')}`;
  }
  return err;
}

function getTypeList(msg) {
  let types = [ msg?.type ];
  for (let prop in msg) {
    if (msg[prop]?.type) {
      types = [...types, ...getTypeList(msg[prop])];
    }
  }
  return types;
}

function getSchemaType(error) {
  const schemaTypeRes = error.schemaPath.match(/#\/\w+\/\w+\/([\w-]+)\//);
  return schemaTypeRes ? schemaTypeRes[1] : undefined;
}

function getErrType(error) {
  const errTypeRes = error.instancePath.match(/\/([\w]+)/);
  return errTypeRes ? errTypeRes[1] : undefined;
}

function getPartsCount(error, types) {
  const schemaType = getSchemaType(error);
  const errType = getErrType(error);
  if (!errType) { return -1; }
  if (!types[errType].includes(schemaType)) { return -1; }
  const parts = error.instancePath.split('/');
  return parts.length;
}

function getTypes(msg) {
  return {
    actor: getTypeList(msg.actor),
    target: getTypeList(msg.target),
    object: getTypeList(msg.context ? msg.object : msg)
  };
}

/**
 * Traverses the errors array from ajv, and makes a series of filtering decisions to
 * try to arrive at the most useful error.
 * @param msg
 * @param errors
 * @returns {string}
 */
function getErrorMessage(msg, errors) {
  const types = getTypes(msg);
  let deepest_entry = 0, highest_depth = -1;

  for (let i = 0; i < errors.length; i++) {
    const partsCount = getPartsCount(errors[i], types);
    if (partsCount > highest_depth) {
      highest_depth = partsCount;
      deepest_entry = i;
    }
  }

  return highest_depth >= 0 ?
    parseMsg(errors[deepest_entry]) :
    composeFinalError(errors[errors.length - 1]);
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
  return handleValidation(`${schemaURL}/activity-object`, msg, true);
}

function validateActivityStream(msg) {
  return handleValidation(`${schemaURL}/activity-stream`, msg);
}

function validateCredentials(msg) {
  if (!msg.context) {
    return 'credential activity streams must have a context set';
  }
  if (msg.type !== 'credentials') {
    return 'credential activity streams must have credentials set as type';
  }
  return handleValidation(`${schemaURL}/context/${msg.context}/credentials`, msg);
}

function handleValidation(schemaRef, msg, isObject=false) {
  const validator = ajv.getSchema(schemaRef);
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

function validatePlatformSchema(schema) {
  const validate = ajv.compile(platformSchema);
  // validate schema property
  const err = validate(schema);
  if (! err) {
    console.log('res: ', validate);
    return `platform schema failed to validate: ` +
      `${validate.errors[0].instancePath} ${validate.errors[0].message}`;
  } else {
    return false;
  }
}

function addPlatformSchema(schema, platform_type) {
  log(`registering schema ${schemaURL}/context/${platform_type}`);
  ajv.addSchema(schema, `${schemaURL}/context/${platform_type}`);
}

module.exports = {
  addPlatformSchema,
  validateCredentials,
  validateActivityObject,
  validateActivityStream,
  validatePlatformSchema
};