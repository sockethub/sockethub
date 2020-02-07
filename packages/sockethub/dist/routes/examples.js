"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const randToken = __importStar(require("rand-token"));
const config_1 = __importDefault(require("./../config"));
const routes = [], debug_scope = process.env.DEBUG || '', address = config_1.default.get('public:protocol') + '://' +
    config_1.default.get('public:host') + ':' +
    config_1.default.get('public:port') +
    config_1.default.get('public:path');
if (config_1.default.get('examples:enabled')) {
    // only add routes if --dev flag is present
    routes.push({
        meta: {
            method: 'GET',
            path: '/examples/dummy'
        },
        route: (req, res) => {
            res.render(path_1.default.resolve(__dirname + './../../views/examples/dummy.ejs'), {
                debug_scope: debug_scope,
                address: address
            });
        }
    }, {
        meta: {
            method: 'GET',
            path: '/examples/feeds'
        },
        route: (req, res) => {
            res.render(path_1.default.resolve(__dirname + './../../views/examples/feeds.ejs'), {
                debug_scope: debug_scope,
                address: address
            });
        }
    }, {
        meta: {
            method: 'GET',
            path: '/examples/irc'
        },
        route: (req, res) => {
            res.render(path_1.default.resolve(__dirname + './../../views/examples/irc.ejs'), {
                debug_scope: debug_scope,
                address: address,
                randToken: randToken.generate(5)
            });
        }
    }, {
        meta: {
            method: 'GET',
            path: '/examples/xmpp'
        },
        route: (req, res) => {
            res.render(path_1.default.resolve(__dirname + './../../views/examples/xmpp.ejs'), {
                debug_scope: debug_scope,
                address: address,
                randToken: randToken.generate(5)
            });
        }
    });
}
/**
 * Setup
 */
const routeExamples = {
    setup: function (app) {
        routes.forEach((route) => {
            app[route.meta.method.toLowerCase()](route.meta.path, route.route);
        });
    }
};
exports.default = routeExamples;
//# sourceMappingURL=examples.js.map