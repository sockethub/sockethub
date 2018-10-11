const path = require('path')

module.exports = {
  entry: './lib/activity-streams.js',
  output: {
    filename: 'activity-streams.min.js',
    path: path.resolve(__dirname, 'browser'),
    libraryTarget: 'umd'
  }
};