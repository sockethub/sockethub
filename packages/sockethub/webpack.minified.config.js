const path = require('path');

module.exports = {
  entry: './dist/sockethub-client.js',
  mode: "production",
  optimization: {
    minimize: true
  },
  output: {
    filename: './dist/sockethub-client.min.js',
    path: path.resolve(__dirname, './'),
    libraryTarget: 'umd'
  }
};