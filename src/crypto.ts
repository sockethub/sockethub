import * as cryptoLib from 'crypto';

const ALGORITHM = 'aes-256-cbc',
      IV_LENGTH = 16; // For AES, this is always 16

let crypto;

class Crypto {
  constructor() {}
  encrypt = (json: object, secret: string) => {
    const iv = cryptoLib.randomBytes(IV_LENGTH);
    const cipher = cryptoLib.createCipheriv(ALGORITHM, Buffer.from(secret), iv);
    let encrypted = cipher.update(JSON.stringify(json));

    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  };
  decrypt = (text: string, secret: string) => {
    let parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = cryptoLib.createDecipheriv(ALGORITHM, Buffer.from(secret), iv);
    let decrypted = decipher.update(encryptedText);

    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
  };
}

crypto = crypto ? crypto : new Crypto();
export default crypto;