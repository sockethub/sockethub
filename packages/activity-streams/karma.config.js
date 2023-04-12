module.exports = function (config) {
  config.set({
    frameworks: ['mocha', 'chai'],
    files: [
      "dist/**/*.test.js"
    ],
    reporters: ['progress'],
    plugins: [
      'karma-chai', 'karma-mocha',
      'karma-chrome-launcher', 'karma-firefox-launcher'
    ],
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
