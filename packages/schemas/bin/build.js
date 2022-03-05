#!/usr/bin/env node
const Ajv = require('ajv');
const debug = require('debug');
const fs = require('fs');

const ajv = new Ajv();
const log = debug('sockethub:schemas');
let base = process.env.PWD;

let schemaSHAS = require('../src/sockethub-activity-stream');
let schemaSHAO = require('../src/sockethub-activity-object');

// load sockethub-activity-stream schema and register
ajv.addSchema(schemaSHAS, schemaSHAS.id);
// load sockethub-activity-object schema and register
ajv.addSchema(schemaSHAO, schemaSHAO.id);

let fd = fs.openSync(base + '/schemas/activity-stream.js', 'w+');
fs.writeSync(fd, 'module.exports = ' + JSON.stringify(schemaSHAS, null, "\t") + ';');
fd = fs.openSync(base + '/schemas/activity-stream.json', 'w+');
fs.writeSync(fd, JSON.stringify(schemaSHAS, null, "\t"));

fd = fs.openSync(base + '/schemas/activity-object.js', 'w+');
fs.writeSync(fd, 'module.exports = ' + JSON.stringify(schemaSHAO, null, "\t") + ';');
fd = fs.openSync(base + '/schemas/activity-object.json', 'w+');
fs.writeSync(fd, JSON.stringify(schemaSHAO, null, "\t"));

log('updated Sockethub activity stream schemas');
