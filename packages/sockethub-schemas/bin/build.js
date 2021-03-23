#!/usr/bin/env node
import tv4 from 'tv4';
import debug from 'debug';
import fs from 'fs';

const log = debug('sockethub:schemas');
let base = process.env.PWD;

let schemaSHAS = require('../src/sockethub-activity-stream');
let schemaSHAO = require('../src/sockethub-activity-object');

// load sockethub-activity-stream schema and register it with tv4
tv4.addSchema(schemaSHAS.id, schemaSHAS);
// load sockethub-activity-object schema and register it with tv4
tv4.addSchema(schemaSHAO.id, schemaSHAO);

let fd = fs.openSync(base + '/schemas/activity-stream.js', 'w+');
fs.writeSync(fd, 'module.exports = ' + JSON.stringify(schemaSHAS, null, "\t") + ';');
fd = fs.openSync(base + '/schemas/activity-stream.json', 'w+');
fs.writeSync(fd, JSON.stringify(schemaSHAS, null, "\t"));

fd = fs.openSync(base + '/schemas/activity-object.js', 'w+');
fs.writeSync(fd, 'module.exports = ' + JSON.stringify(schemaSHAO, null, "\t") + ';');
fd = fs.openSync(base + '/schemas/activity-object.json', 'w+');
fs.writeSync(fd, JSON.stringify(schemaSHAO, null, "\t"));

log('updated sockethub activity stream schemas');
