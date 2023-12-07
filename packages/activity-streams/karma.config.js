module.exports = function (config) {
    config.set({
        frameworks: ["mocha", "chai"],
        files: ["dist/**/*.test.js"],
        reporters: ["progress"],
        plugins: [
            "karma-chai",
            "karma-mocha",
            "karma-chrome-launcher",
        ],
        port: 9876, // karma web server port
        colors: true,
        logLevel: config.LOG_INFO,
        browsers: ["ChromeHeadless"],
        autoWatch: false,
        concurrency: Infinity,
    });
};
