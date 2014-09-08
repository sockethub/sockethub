var crypto          = require('crypto');

function encrypt(key, string) {
  var cipher = crypto.createCipher("aes192", key),
        msg = [];
  msg.push(cipher.update(string, "binary", "hex"));
  msg.push(cipher.final("hex"));
  return msg.join("");
}

function decrypt(key, encstring) {
  var string = '{}';
  try {
    var decipher = crypto.createDecipher("aes192", key),
        msg = [];

    msg.push(decipher.update(encstring, "hex", "binary"));
    msg.push(decipher.final("binary"));
    string = msg.join("");
  } catch (e) {
    console.error(' [session] unable to decrypt encrypted string. returning empty object');
    string = '{}';
  }
  return string;
}

module.exports = {
  encrypt: encrypt,
  decrypt: decrypt
};