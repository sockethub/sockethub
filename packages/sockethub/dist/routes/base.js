"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("./../config"));
let routes = [];
routes.push({
    meta: {
        method: 'GET',
        path: '/sockethub-client.js'
    },
    route: (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.sendFile(path_1.default.resolve(__dirname + '/../js/client.js'));
    }
}, {
    meta: {
        method: 'GET',
        path: '/socket.io.js'
    },
    route: (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.sendFile(path_1.default.resolve(`${__dirname}/../../node_modules/socket.io-client/dist/socket.io.js`));
    }
}, {
    meta: {
        method: 'GET',
        path: '/activity-streams.js'
    },
    route: (req, res) => {
        res.sendFile(path_1.default.resolve(__dirname
            + '/../../node_modules/activity-streams/browser/activity-streams.js'));
    }
}, {
    meta: {
        method: 'GET',
        path: '/activity-streams.min.js'
    },
    route: (req, res) => {
        res.sendFile(path_1.default.resolve(__dirname
            + '/../../node_modules/activity-streams/browser/activity-streams.min.js'));
    }
});
if (config_1.default.get('examples:enabled')) {
    routes.push({
        meta: {
            method: 'GET',
            path: '/'
        },
        route: (req, res) => {
            res.render('index.ejs');
        }
    }, {
        meta: {
            method: 'GET',
            path: '/jquery.js'
        },
        route: (req, res) => {
            res.sendFile(path_1.default.resolve(__dirname + '/../../node_modules/jquery/dist/jquery.min.js'));
        }
    }, {
        meta: {
            method: 'GET',
            path: '/examples/shared.js'
        },
        route: (req, res) => {
            res.sendFile(path_1.default.resolve(__dirname + '/../../views/examples/shared.js'));
        }
    }, {
        meta: {
            method: 'GET',
            path: '/jquery.min.map'
        },
        route: (req, res) => {
            res.sendFile(path_1.default.resolve(__dirname + '/../../node_modules/jquery/dist/jquery.min.map'));
        }
    });
}
/**
 * Setup
 */
const routeBase = {
    setup: function (app) {
        routes.forEach((route) => {
            app[route.meta.method.toLowerCase()](route.meta.path, route.route);
        });
    }
};
exports.default = routeBase;
//# sourceMappingURL=base.js.map