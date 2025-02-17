/* eslint-disable @typescript-eslint/no-require-imports */
const packageJSON = require("./package.json");
const moduleList = Object.keys(packageJSON.dependencies);

const rx = /^@sockethub\/platform-/i;
const platforms = [];

for (const moduleName of moduleList) {
    if (rx.test(moduleName)) {
        platforms.push(moduleName);
    }
}
