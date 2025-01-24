module.exports = function (config) {
    config.set({
        frameworks: ["mocha"],
        files: ["dist/**/*.test.js"],
        reporters: ["progress"],
        plugins: ["karma-mocha", "karma-chrome-launcher"],
        port: 9876, // karma web server port
        colors: true,
        logLevel: config.LOG_INFO,
        browsers: ["ChromeHeadless"],
        autoWatch: false,
        concurrency: Infinity,
    });
};
