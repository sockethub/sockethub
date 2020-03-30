"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const platformName = process.argv[3];
const identifier = process.argv[2];
const logger = debug_1.default('sockethub:platform');
logger(`platform handler initialized for ${platformName} ${identifier}`);
const PlatformModule = require(`sockethub-platform-${platformName}`);
/**
 * Handle any uncaught errors from the platform by alerting the worker and shutting down.
 */
process.on('uncaughtException', (err) => {
    console.log(`\nUNCAUGHT EXCEPTION IN PLATFORM\n`);
    console.log(err.stack);
    process.send(['error', err.toString()]);
    process.exit(1);
});
/**
 * Incoming messages from the worker to this platform. Data is an array, the first property is the
 * method to call, the rest are params.
 */
process.on('message', (data) => {
    let func = data.shift();
    platform[func](...data, (err, obj) => {
        process.send(['callback', err, obj]);
    });
});
/**
 * sendFunction wrapper, generates a function to pass to the platform class. The platform can
 * call that function to send messages back to the client.
 * @param command
 */
function sendFunction(command) {
    return function (msg) {
        process.send([command, msg]);
    };
}
const platform = new PlatformModule({
    debug: debug_1.default(`sockethub:platform:${platformName}:${identifier}`),
    sendToClient: sendFunction('message'),
    updateCredentials: sendFunction('updateCredentials')
});
//# sourceMappingURL=platform.js.map