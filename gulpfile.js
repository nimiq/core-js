var gulp = require('gulp');

var paths = {
    src: 'src/**/*.js',
    spec: 'spec/**/*-spec.js',
    build: 'dist/slang.min.js'
}

/*
 * 
 * Test
 *
 */
var jasmine = new require('gulp-jasmine-livereload-task');


gulp.task('default', function() {
    gulp.run(jasmine({
        files: [paths.src, paths.spec]
    }));
});

gulp.task('watch', function() {
    gulp.run('build');
    gulp.watch(paths.src, ['build']);
});

gulp.task('test-build', ['watch'], function() {
    gulp.run(jasmine({
        files: [paths.build, paths.spec]
    }));
});
