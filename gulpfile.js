var gulp = require('gulp');

var paths = {
    src: ['src/**/*.js'],
    spec: 'specs/**/*.spec.js',
    build: ' TODO '
}

/*
 *
 * Test
 *
 */
var jasmine = new require('gulp-jasmine-livereload-task');


gulp.task('default', function() {
    gulp.run(jasmine({
        files: ['src/utils/**/*.js','src/**/*.js','specs/**/*.spec.js']
    }));
});

// gulp.task('watch', function() {
//     gulp.run('build');
//     gulp.watch(paths.src, ['build']);
// });

// gulp.task('test-build', ['watch'], function() {
//     gulp.run(jasmine({
//         files: [paths.build, paths.test]
//     }));
// });
