const path = require('path');

module.exports = {
  entry: './dist/client/sockethub-client.js',
  mode: "production",
  optimization: {
    minimize: false
  },
  output: {
    filename: './dist/client/sockethub-client.js',
    path: path.resolve(__dirname, './'),
    libraryTarget: 'umd'
  }
};