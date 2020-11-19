"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
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