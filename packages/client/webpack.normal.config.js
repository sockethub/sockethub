const path = require('path');

module.exports = {
  entry: './dist/sockethub-client.js',
  mode: "production",
  optimization: {
    minimize: false
  },
  output: {
    filename: './dist/sockethub-client.js',
    path: path.resolve(__dirname, './'),
    libraryTarget: 'umd'
  }
};