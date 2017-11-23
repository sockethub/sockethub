/**
 * bootstrap/platforms.js
 *
 * A Singleton responsible for finding and loading all valid sockethub
 * platforms, and whitelisting or blacklisting (or neither) based on the
 * config.
 *
 */

let ArrayKeys      = require("array-keys"),
    tv4            = require("tv4"),
    debug          = require("debug")("sockethub:bootstrap:platforms"),
    whitelist      = require("nconf").get("platforms:whitelist"),
    blacklist      = require("nconf").get("platforms:blacklist"),
    platformSchema = require("sockethub-schemas").platform;


module.exports = function (keys) {
  debug("finding and registering platforms");
  let platforms = new ArrayKeys(),
      prefix    = "sockethub-platform-";

  // load platforms from package.json
  let rx = new RegExp("^" + prefix, "i");

  for (let i = 0, len = keys.length; i < len; i += 1) {
    if (rx.test(keys[i])) {
      // found a sockethub platform
      let platformName = keys[i].replace(rx, "");
      let willLoad = false;

      if (whitelist.length > 0) {
        if (whitelist.indexOf(platformName) >= 0) {
          willLoad = true;
        }
      } else if (blacklist.length > 0) {
        if (blacklist.indexOf(platformName) < 0) {
          willLoad = true;
        }
      } else {
        willLoad = true;
      }

      if (willLoad) {
        debug("validating " + platformName + " platform");
        let p, pjson, types = [], credentials, credentialsSchema;
        // try to load platform
        try {
          p = require(keys[i]);
          p = new p();
        } catch (e) {
          throw new Error(e);
        }

        try {
          pjson = require("./../../node_modules/" + keys[i] + "/package.json");
        } catch (e) {
          throw new Error(e);
        }

        // validate schema property
        if (! tv4.validate(p.schema, platformSchema)) {
          throw new Error("platform " + platformName + " schema: " + tv4.error.message);
        }

        if (p.schema.credentials) {
          // register the platforms credentials schema
          credentials = p.schema.credentials;
          credentialsSchema = credentials;
          types.push("credentials");
        }

        let messages = p.schema.messages;
        let messagesSchema = messages;
        tv4.addSchema("http://sockethub.org/schemas/v0/context/" + platformName + "/credentials", credentialsSchema);
        tv4.addSchema("http://sockethub.org/schemas/v0/context/" + platformName + "/messages", messagesSchema);

        debug("registering " + platformName + " platform");

        if ((p.schema.messages.properties) && (p.schema.messages.properties["@type"]) &&
            (p.schema.messages.properties["@type"].enum) && (p.schema.messages.properties["@type"].enum.length > 0)) {
          for (let n = 0, lenn = p.schema.messages.properties["@type"].enum.length; n <= lenn; n++) {
            types.push(p.schema.messages.properties["@type"].enum[n]);
          }
        }

        platforms.addRecord({
          id: platformName,
          moduleName: keys[i],
          version: pjson.version,
          "@types": (types.length > 1) ? types.sort().join(", ").slice(0, -2) : types.join()
        });
      }
    }
  }

  return platforms;
};
