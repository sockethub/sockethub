"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const config_1 = __importDefault(require("../config"));
const platforms_1 = __importDefault(require("./platforms"));
const log = debug_1.default('sockethub:bootstrap:init');
log('running init routines');
const packageJSON = require('./../../package.json');
const platforms = platforms_1.default(Object.keys(packageJSON.dependencies));
log('loaded platforms');
if (config_1.default.get('help')) {
    console.log(packageJSON.name + ' ' + packageJSON.version);
    console.log('command line args: ');
    console.log();
    console.log('  --help     : this help screen');
    console.log('  --info     : displays some basic runtime info');
    console.log();
    console.log('  --examples : enables examples page and serves helper files like jquery');
    console.log();
    console.log('  --host     : hostname to bind to');
    console.log('  --port     : port to bind to');
    console.log();
    process.exit();
}
else if (config_1.default.get('info')) {
    console.log(packageJSON.name + ' ' + packageJSON.version);
    console.log();
    console.log('examples enabled: ' + config_1.default.get('examples:enabled'));
    console.log('sockethub: ' + config_1.default.get('service:host') + ':' + config_1.default.get('service:port')
        + config_1.default.get('service:path'));
    if (config_1.default.get('redis:url')) {
        console.log('redis URL: ' + config_1.default.get('redis:url'));
    }
    else {
        console.log('redis: ' + config_1.default.get('redis:host') + ':' + config_1.default.get('redis:port'));
    }
    if (config_1.default.get('kue:enabled')) {
        console.log('kue: ' + config_1.default.get('kue:host') + ':' + config_1.default.get('kue:port'));
    }
    else {
        console.log('kue: disabled');
    }
    console.log('public url: ' + config_1.default.get('public:host') + ':' + config_1.default.get('public:port')
        + config_1.default.get('public:path'));
    console.log();
    console.log('platforms: ' + Array.from(platforms.keys()).join(', '));
    if (platforms.size > 0) {
        for (let platform of platforms.values()) {
            console.log();
            console.log('  ' + platform.id + ' v' + platform.version);
            console.log('    AS @types: ' + platform['@types']);
        }
        console.log();
        process.exit();
    }
    else {
        console.log();
        process.exit();
    }
}
log('finished init routines');
const init = {
    version: packageJSON.version,
    platforms: platforms
};
exports.default = init;
//# sourceMappingURL=init.js.map