module.exports = function (config) {
  config.set({
    frameworks: ['mocha', 'chai'],
    files: [
      'test/integration.test.js',
    ],
    plugins: [
      'karma-chai', 'karma-mocha', 'karma-mocha-reporter',
      'karma-chrome-launcher', 'karma-firefox-launcher'
    ],
    reporters: [ 'mocha' ],
    port: 9876,  // karma web server port
    colors: true,
    logLevel: config.LOG_INFO,
    browsers: ['ChromeHeadless', 'Firefox'],
    autoWatch: false,
    concurrency: Infinity,
    customLaunchers: {
      FirefoxHeadless: {
        base: 'Firefox',
        flags: ['-headless'],
      },
    }
  });
};