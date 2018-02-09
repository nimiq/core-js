// Karma configuration
// Generated on Tue May 09 2017 23:26:08 GMT+0200 (CEST)

module.exports = function (config) {
    const configuration = {

        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '',


        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['jasmine'],


        // list of files / patterns to load in the browser
        files: [
            'dist/web.js',
            'src/test/specs/**/*.spec.js',
            { pattern: 'dist/worker*', included: false },
            { pattern: 'dist/*.map', included: false }
        ],


        // list of files to exclude
        exclude: [],


        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {},


        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['progress', 'saucelabs'],


        // web server port
        port: 9876,


        // enable / disable colors in the output (reporters and logs)
        colors: true,


        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_INFO,


        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: true,


        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ['Chrome'],


        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: true,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: 1,

        customLaunchers: {
            'Travis_Chrome': {
                base: 'Chrome',
                flags: ['--no-sandbox']
            }
        },

        sauceLabs: {
            testName: 'Nimiq Core Tests',
            startConnect: false,
            tunnelIdentifier: process.env.TRAVIS_JOB_NUMBER,
            build: process.env.TRAVIS_BUILD_NUMBER,
            tags: [process.env.TRAVIS_BRANCH, process.env.TRAVIS_PULL_REQUEST]
        },

        browserNoActivityTimeout: 120000
    };

    function sauceLabsConfig(platform, browserName, version, browserRead, versionRead) {
        configuration.customLaunchers[`SL_${browserRead || browserName}_${versionRead || version}`] = {
            base: 'SauceLabs',
            browserName: browserName,
            platform: platform,
            version: version
        };
    }

    // Safari
    sauceLabsConfig('OS X 10.11', 'safari', '10.0', 'Safari');
    sauceLabsConfig('macOS 10.12', 'safari', '10.1', 'Safari');
    sauceLabsConfig('macOS 10.12', 'safari', '11.0', 'Safari', '11');

    // Edge / Internet Explorer
    sauceLabsConfig('Windows 7', 'internet explorer', '11.0', 'InternetExplorer', '11');
    sauceLabsConfig('Windows 10', 'MicrosoftEdge', '14.14393', 'Edge', '14');
    sauceLabsConfig('Windows 10', 'MicrosoftEdge', '15.15063', 'Edge', '15');
    sauceLabsConfig('Windows 10', 'MicrosoftEdge', '16.16299', 'Edge', '16');

    // Firefox
    for (const version of [48, 52, 55, 56]) sauceLabsConfig('Windows 10', 'firefox', `${version}.0`, 'Firefox', version);

    // Chrome
    sauceLabsConfig('Windows 7', 'chrome', '56.0', 'Chrome', '56');
    for (const version of [57, 58, 59, 60, 61, 62]) sauceLabsConfig('Windows 10', 'chrome', `${version}.0`, 'Chrome', version);

    if (process.env.USE_BABEL) {
        configuration.files[0] = 'dist/web-babel.js';
    }
    if (process.env.USE_ISTANBUL) {
        configuration.files[0] = 'dist/web-istanbul.js';
        configuration.reporters.push('coverage');
        configuration.coverageReporter = {
            reporters: [
                {type:'html', subdir: '.'},
                {type:'lcovonly', subdir: '.'},
                {type:'json', subdir: '.'}
            ]
        };
    }
    if (process.env.KARMA_BROWSERS) {
        configuration.browsers = process.env.KARMA_BROWSERS.split(',');
    }
    if (process.env.EXCLUDE_MINER) {
        configuration.exclude.push('src/test/specs/generic/miner/Miner.spec.js');
    }
    config.set(configuration);
};
