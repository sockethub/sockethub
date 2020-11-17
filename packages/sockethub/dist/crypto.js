"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const cryptoLib = __importStar(require("crypto"));
const ALGORITHM = 'aes-256-cbc', IV_LENGTH = 16; // For AES, this is always 16
let crypto;
class Crypto {
    constructor() { }
    encrypt(json, secret) {
        const iv = cryptoLib.randomBytes(IV_LENGTH);
        const cipher = cryptoLib.createCipheriv(ALGORITHM, Buffer.from(secret), iv);
        let encrypted = cipher.update(JSON.stringify(json));
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }
    decrypt(text, secret) {
        let parts = text.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const decipher = cryptoLib.createDecipheriv(ALGORITHM, Buffer.from(secret), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return JSON.parse(decrypted.toString());
    }
    hash(text) {
        const shasum = cryptoLib.createHash('sha1');
        shasum.update(text);
        return shasum.digest('hex').substring(0, 7);
    }
}
crypto = new Crypto();
exports.default = crypto;
//# sourceMappingURL=crypto.js.map