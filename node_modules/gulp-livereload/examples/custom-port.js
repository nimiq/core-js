'use strict';

var gulp = require('gulp'),
    less = require('gulp-less'),
    livereload = require('gulp-livereload');

gulp.task('less', function() {
  gulp.src('less/*.less')
    .pipe(less())
    .pipe(gulp.dest('dist/styles'))
    .pipe(livereload());
});

gulp.task('watch', function() {
  livereload.listen(1234);
  // livereload.listen({ port: 1234, basePath: 'dist' });
  gulp.watch('less/*.less', ['less']);
});
