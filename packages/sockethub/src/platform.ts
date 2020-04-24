import debug from 'debug';
import services from './services';
import crypto from "./crypto";
import SharedResources from "./shared-resources";

const parentId = process.argv[2];
const platformName = process.argv[3];
const identifier = process.argv[4];
const logger = debug('sockethub:platform');
logger(`platform handler initialized for ${platformName} ${identifier}`);
const PlatformModule = require(`sockethub-platform-${platformName}`);
const queue = services.startQueue(parentId);

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
  console.log('incoming message', data);
  let func = data.shift();
  platform[func](...data, (err, obj) => {
    console.log('sending back job results', err, obj);
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
  debug: debug(`sockethub:platform:${platformName}:${identifier}`),
  sendToClient: sendFunction('message'),
  updateCredentials: sendFunction('updateCredentials')
});

queue.process(identifier, (job, done) => {
  console.log("platform process rceived job ", job.data.msg);
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
});