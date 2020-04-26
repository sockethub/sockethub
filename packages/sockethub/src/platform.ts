import debug from 'debug';
import services from './services';
import crypto from "./crypto";
import SharedResources from "./shared-resources";
import hash from "object-hash";

const parentId = process.argv[2];
const platformName = process.argv[3];
const identifier = process.argv[4];
const logger = debug('sockethub:platform');
logger(`platform handler initialized for ${platformName} ${identifier}`);
const PlatformModule = require(`sockethub-platform-${platformName}`);
const queue = services.startQueue(parentId);

let parentSecret1, parentSecret2;

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
process.on('message', (msg) => {
  console.log('incoming IPC message: ' + msg.type, msg.data);
  if (msg.type === 'secrets') {
    parentSecret1 = msg.data.parentSecret1;
    parentSecret2 = msg.data.parentSecret2;
    startQueueListener()
  }
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

// TODO handle credential fetching
// function getCredentials(id, cb) {
//   this.store.get(platformInstance.actor['@id'], (err, credentials) => {
//     if (platformInstance.config.persist) {
//       // don't continue if we don't get credentials
//       if (err) { return cb(err); }
//       this.persistPlatformInstance(platformInstance);
//     }
//
//     if (platformInstance.credentialsHash) {
//       if (platformInstance.credentialsHash !== hash(credentials.object)) {
//         return cb('provided credentials do not match existing platform instance for actor '
//             + platformInstance.actor['@id']);
//       }
//     } else {
//       platformInstance.credentialsHash = hash(credentials.object);
//     }
//     cb(undefined, credentials);
//   });
// }

const platform = new PlatformModule({
  debug: debug(`sockethub:platform:${platformName}:${identifier}`),
  sendToClient: sendFunction('message'),
  updateCredentials: sendFunction('updateCredentials')
});

function startQueueListener() {
  console.log('starting queue listener');
  queue.process(identifier, (job, done) => {
    console.log("platform process received job ", job.data.msg);
    job.data.msg = crypto.decrypt(job.data.msg, parentSecret1 + parentSecret2);
    console.log("platform process decreypted job ", job.data.msg);
    platform[job.data.msg['@type']](job.data.msg, credentials, done);
  });
}

// job.data.msg = crypto.decrypt(job.data.msg, parentSecret1 + parentSecret2);
// this.log(`got job #${job.id}: ${job.data.msg['@type']}`);
//
// let identifier = SharedResources.platformMappings.get(job.data.msg.actor['@id']);
// const platformInstance = identifier ? SharedResources.platformInstances.get(identifier) :
//     this.__getPlatformInstance(job, randToken.generate(16));
//
// // try to get credentials for this specific secret + socket.id
// // (each websocket connection must specify credentials to access initialized platforms)
// this.getCredentials(platformInstance, (err, credentials) => {
//   if (err) { return done(err); }
//   this.jobComplete = done;
//   // run corresponding platformInstance method
//   platformInstance.process.send([job.data.msg['@type'], job.data.msg, credentials]);
// });

console.log('process started')