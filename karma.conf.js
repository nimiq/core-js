// Karma configuration
// Generated on Tue May 09 2017 23:26:08 GMT+0200 (CEST)

module.exports = function(config) {
  var configuration = {

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],


    // list of files / patterns to load in the browser
    files: [
      'src/main/platform/browser/Class.js',
      'src/main/generic/utils/Observable.js',
      'src/main/platform/browser/**/*.js',
      'src/main/generic/utils/**/*.js',
      'src/main/generic/consensus/primitive/Primitive.js',
      'src/main/generic/consensus/primitive/**/*.js',
      'src/main/generic/consensus/block/BlockHeader.js',
      'src/main/generic/consensus/block/BlockBody.js',
      'src/main/generic/network/struct/*.js',
      'src/main/generic/network/message/Message.js ',
      'src/main/generic/network/message/*Message.js ',
      'src/main/generic/consensus/account/Address.js',
      'src/main/generic/**/*.js',
      'src/test/specs/**/Dummy.spec.js',
      'src/test/specs/**/*.spec.js'
    ],


    // list of files to exclude
    exclude: [
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
    },


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
    browsers: ['Chrome'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,

    customLaunchers: {
        Chrome_travis_ci: {
            base: 'Chrome',
            flags: ['--no-sandbox']
        }
    }
  };

  if (process.env.TRAVIS) {
      configuration.browsers = ['Chrome_travis_ci'];
  }
  config.set(configuration);
}
