var tv4       = require('tv4'),
    debug     = require('debug')('sockethub:schemas'),
    fs        = require('fs');

debug('running init routines');

var schemaSHAS = require('./src/sockethub-activity-stream');
var schemaSHAO = require('./src/sockethub-activity-object');

// load sockethub-activity-stream schema and register it with tv4
tv4.addSchema(schemaSHAS.id, schemaSHAS);
// load sockethub-activity-object schema and register it with tv4
tv4.addSchema(schemaSHAO.id, schemaSHAO);

var fd = fs.openSync('schemas/activity-stream.json', 'w+');
fs.writeSync(fd, JSON.stringify(schemaSHAS, null, "\t"));

fd = fs.openSync('schemas/activity-object.json', 'w+');
fs.writeSync(fd, JSON.stringify(schemaSHAO, null, "\t"));
