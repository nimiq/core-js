'use strict'

/**
 * Why not use the restart event, you may ask.
 *
 * The http server might not have started listening yet when
 * the `restart` event has been triggered. It's best to check
 * whether it is already listening for connections or not.
 */


var gulp = require('gulp')
var livereload = require('gulp-livereload')
var nodemon = require('nodemon')

gulp.task('watch', function() {
  livereload.listen()

  nodemon({
    script: 'index.js',
    stdout: false
  }).on('readable', function() {
    this.stdout.on('data', function(chunk) {
      if (/^listening/.test(chunk)) {
        livereload.reload()
      }
      process.stdout.write(chunk)
    })
  })
})
