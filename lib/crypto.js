const crypto = require('crypto'),
      ALGORITHM = 'aes-256-cbc',
      IV_LENGTH = 16; // For AES, this is always 16


module.exports = {
  encrypt: function (json, secret) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, new Buffer.from(secret), iv);
    let encrypted = cipher.update(JSON.stringify(json));

    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  },
  decrypt: function (string, secret) {
    let parts = string.split(':');
    const iv = new Buffer.from(parts.shift(), 'hex');
    const encryptedText = new Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, new Buffer.from(secret), iv);
    let decrypted = decipher.update(encryptedText);

    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
  }
};