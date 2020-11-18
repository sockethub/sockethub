"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformId = exports.getSessionStore = void 0;
const secure_store_redis_1 = __importDefault(require("secure-store-redis"));
const debug_1 = __importDefault(require("debug"));
const config_1 = __importDefault(require("./config"));
const crypto_1 = __importDefault(require("./crypto"));
const logger = debug_1.default('sockethub:common');
function getSessionStore(parentId, parentSecret, sessionId, sessionSecret) {
    return new secure_store_redis_1.default({
        namespace: 'sockethub:' + parentId + ':session:' + sessionId + ':store',
        secret: parentSecret + sessionSecret,
        redis: config_1.default.get('redis')
    });
}
exports.getSessionStore = getSessionStore;
function getPlatformId(platform, actor) {
    return actor ? crypto_1.default.hash(platform + actor) : crypto_1.default.hash(platform);
}
exports.getPlatformId = getPlatformId;
//# sourceMappingURL=common.js.map