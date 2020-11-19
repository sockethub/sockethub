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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const body_parser_1 = __importDefault(require("body-parser"));
const express_1 = __importDefault(require("express"));
const HTTP = __importStar(require("http"));
const kue_1 = __importDefault(require("kue"));
const socket_io_1 = __importDefault(require("socket.io"));
const config_1 = __importDefault(require("./config"));
const base_1 = __importDefault(require("./routes/base"));
const examples_1 = __importDefault(require("./routes/examples"));
const log = debug_1.default('sockethub:services');
let redisCfg = config_1.default.get('redis');
if (redisCfg.url) {
    redisCfg = redisCfg.url;
}
log('redis connection info ', redisCfg);
const services = {
    startQueue: function (parentId) {
        const channel = `sockethub:${parentId}`;
        log(`queue started on channel ${channel}`);
        return kue_1.default.createQueue({
            prefix: channel,
            redis: redisCfg
        });
    },
    startExternal: function () {
        const app = this.__initExpress();
        // initialize express and socket.io objects
        const http = new HTTP.Server(app);
        const io = socket_io_1.default(http, { path: config_1.default.get('service:path') });
        // routes list
        [
            base_1.default,
            examples_1.default
        ].map((route) => {
            return route.setup(app);
        });
        this.__startKue();
        this.__startListener(http);
        return io;
    },
    __startKue: function () {
        if (config_1.default.get('kue:enabled')) {
            // start kue UI
            kue_1.default.app.listen(config_1.default.get('kue:port'), config_1.default.get('kue:host'), () => {
                log('service queue interface listening on ' + config_1.default.get('kue:host') + ':'
                    + config_1.default.get('kue:port'));
            });
        }
    },
    __startListener: function (http) {
        http.listen(config_1.default.get('service:port'), config_1.default.get('service:host'), () => {
            log(`sockethub listening on ` +
                `http://${config_1.default.get('service:host')}:${config_1.default.get('service:port')}`);
        });
    },
    __initExpress: function () {
        let app = express_1.default();
        // templating engines
        app.set('view engine', 'ejs');
        // use bodyParser
        app.use(body_parser_1.default.urlencoded({ extended: true }));
        app.use(body_parser_1.default.json());
        return app;
    }
};
exports.default = services;
//# sourceMappingURL=services.js.map