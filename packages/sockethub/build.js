
const fs = require('fs');
const packageJSON = require('./package.json');
const moduleList = Object.keys(packageJSON.dependencies);

const rx = new RegExp('^@sockethub/platform-', 'i');
const platforms = [];

for (let moduleName of moduleList) {
  if (rx.test(moduleName)) {
    platforms.push(moduleName);
  }
}

const data = fs.readFileSync(
  'node_modules/@sockethub/server/sockethub.config.example.json', 'utf8');
const config = JSON.parse(data);
config.platforms = platforms;

fs.writeFileSync(
  './sockethub.config.json', data);
