const path = require('path');

module.exports = {
  entry: './dist/client/sockethub-client.js',
  mode: "production",
  optimization: {
    minimize: true
  },
  output: {
    filename: './dist/client/sockethub-client.min.js',
    path: path.resolve(__dirname, './'),
    libraryTarget: 'umd'
  }
};