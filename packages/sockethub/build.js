/* eslint-disable @typescript-eslint/no-require-imports */
const packageJSON = require("./package.json");
const moduleList = Object.keys(packageJSON.dependencies);

const rx = new RegExp("^@sockethub/platform-", "i");
const platforms = [];

for (let moduleName of moduleList) {
    if (rx.test(moduleName)) {
        platforms.push(moduleName);
    }
}
