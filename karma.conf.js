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
            'src/test/specs/*.[sS]pec.js',
            'src/test/specs/generic/*.[sS]pec.js',
            'src/test/specs/generic/utils/**/*.[sS]pec.js',
            'src/test/specs/generic/wallet/**/*.[sS]pec.js',
            'src/test/specs/generic/network/**/*.[sS]pec.js',
            'src/test/specs/generic/consensus/**/*.[sS]pec.js',
            'src/test/specs/generic/miner/**/*.[sS]pec.js',
            'src/test/specs/generic/api/**/*.[sS]pec.js',
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
        reporters: ['progress'],


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
        browsers: [process.env.GITHUB_ACTIONS ? 'ChromeHeadless' : 'Chrome'],


        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: true,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: 1,

        browserNoActivityTimeout: 180000
    };

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
    if (process.env.USE_OFFLINE) {
        configuration.files[0] = 'dist/web-offline.js';
        configuration.files[1] = 'src/test/specs/generic/DummyData.spec.js';
        configuration.files.push('src/test/specs/generic/consensus/base/primitive/*.spec.js');
        configuration.files.push('src/test/specs/generic/consensus/base/account/Address.spec.js');
        configuration.files.push('src/test/specs/generic/consensus/base/transaction/ExtendedTransaction.spec.js');
    }
    if (process.env.USE_ESM) {
        configuration.files = [
            { pattern: 'dist/web.esm.js', included: false },
            { pattern: 'src/test/specs/esm/*.[sS]pec.js', type: 'module' }
        ];
    }
    config.set(configuration);
};
