module.exports = function (config) {
  config.set({
    frameworks: ['mocha', 'chai'],
    files: [
      // 'packages/sockethub/node_modules/socket.io/client-dist/socket.io.min.js',
      // 'packages/activity-streams.js/browser/activity-streams.min.js',
      // 'packages/sockethub/dist/js/client.js',
      // 'http://localhost:10550/sockethub/socket.io.js',
      // 'http://localhost:10550/activity-streams.min.js',
      // 'http://localhost:10550/sockethub-client.js',
      'test/**/*.test.js',
    ],
    reporters: [ 'progress' ],
    port: 9876,  // karma web server port
    colors: true,
    logLevel: config.LOG_INFO,
    // browsers: ['ChromeHeadless', 'Firefox', 'FirefoxDeveloper', 'FirefoxNightly', 'IE'],
    browsers: ['Firefox'],
    autoWatch: false,
    concurrency: Infinity,
    customLaunchers: {
      FirefoxHeadless: {
        base: 'Firefox',
        flags: ['-headless'],
      },
    // },
    // client: {
    //   karmaHTML: {
    //     auto: true,
    //     source: [
    //       { src: 'test/index.html', tag: 'index' }
    //     ]
    //   }
    }
  });
}