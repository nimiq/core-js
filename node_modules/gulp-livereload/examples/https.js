'use strict';

var gulp = require('gulp'),
    less = require('gulp-less'),
    livereload = require('gulp-livereload'),
    read = require('fs').readFileSync;

gulp.task('less', function() {
  gulp.src('less/*.less')
    .pipe(less())
    .pipe(gulp.dest('css'))
    .pipe(livereload());
});

gulp.task('watch', function() {
  livereload.listen({
    key: read('dev.key'),
    cert: read('dev.pem')
  });
  gulp.watch('less/*.less', ['less']);
});
