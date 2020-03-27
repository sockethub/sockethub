import debug from 'debug';
const platformName = process.argv[3];
const identifier = process.argv[2];
const logger = debug('sockethub:platform');
logger(`platform handler initialized for ${platformName} ${identifier}`);
const PlatformModule = require(`sockethub-platform-${platformName}`);

process.on('uncaughtException', (err) => {
  console.log(`\nUNCAUGHT EXCEPTION IN PLATFORM HANDLER\n`);
  console.log(err.stack);
  process.send(['error', err]);
  process.exit(1);
});

process.on('message', (cmds) => {
  console.log('incomming message ', cmds);
  let func = cmds.shift();
  platform[func](...cmds, (data) => {
    console.log('callback called', data);
  });
});

function sendFunction(command) {
  return function (msg) {
    logger('sending message from platform to worker ', msg);
    process.send([command, msg]);
  };
}

const platform = new PlatformModule({
  debug: debug(`sockethub:platform:${platformName}:${identifier}`),
  sendToClient: sendFunction('message'),
  updateCredentials: sendFunction('updateCredentials')
});
