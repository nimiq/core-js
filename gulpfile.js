var gulp = require('gulp');

/*
 *
 * Test
 *
 */
var jasmine = new require('gulp-jasmine-livereload-task');


gulp.task('default', function() {
    gulp.run(jasmine({
        files: [
            'src/generic/utils/indexed-db/indexed-db.js',
            'src/generic/utils/indexed-db/*.js',
        	'src/generic/utils/**/*.js',
        	'src/generic/consensus/primitive/Primitive.js',
        	'src/generic/consensus/primitive/*.js',
            'src/generic/consensus/account/*.js',
            'src/generic/consensus/block/BlockBody.js',
            'src/generic/consensus/block/BlockHeader.js',
            'src/generic/consensus/block/*.js',
            'src/generic/p2p/message/Message.js',
            'src/generic/p2p/message/*Message.js',
            'src/generic/p2p/message/*.js',
            'src/generic/p2p/**/*.js',
            'src/generic/*/**/*.js',
        	'src/generic/*.js',
            'src/test/specs/**/Dummy.spec.js',
        	'src/test/specs/**/*.spec.js'
        ]
    }));
});

gulp.task('sectests', function() {
    gulp.run(jasmine({
        files: [
            'src/generic/utils/indexed-db/indexed-db.js',
            'src/generic/utils/indexed-db/*.js',
            'src/generic/utils/**/*.js',
            'src/generic/consensus/primitive/Primitive.js',
            'src/generic/consensus/primitive/*.js',
            'src/generic/consensus/account/*.js',
            'src/generic/consensus/block/BlockBody.js',
            'src/generic/consensus/block/BlockHeader.js',
            'src/generic/consensus/block/*.js',
            'src/generic/p2p/message/Message.js',
            'src/generic/p2p/message/*Message.js',
            'src/generic/p2p/message/*.js',
            'src/generic/p2p/**/*.js',
            'src/generic/*/**/*.js',
            'src/generic/*.js',
            'sectests/**/Dummy.sectest.js',
            'sectests/**/*.sectest.js'
        ]
    }));
});


var concat = require('gulp-concat');
 
gulp.task('build', function() {
  return gulp.src([
        './src/generic/utils/**/*.js',
        './src/generic/consensus/primitive/Primitive.js', 
        './src/generic/consensus/primitive/**/*.js', 
        './src/generic/consensus/block/BlockHeader.js', 
        './src/generic/consensus/block/BlockBody.js', 
        './src/generic/p2p/message/Message.js', 
        './src/generic/p2p/message/VersionMessage.js', 
        './src/generic/consensus/account/Address.js', 
        './src/generic/**/*.js'])
    .pipe(concat('nimiq.js'))
    .pipe(gulp.dest('./'));
});

gulp.task('build-node', function() {
  return gulp.src([
        './src/generic/utils/**/*.js',
        './src/generic/consensus/primitive/Primitive.js', 
        './src/generic/consensus/primitive/**/*.js', 
        './src/generic/consensus/block/BlockHeader.js', 
        './src/generic/consensus/block/BlockBody.js', 
        './src/generic/p2p/message/Message.js', 
        './src/generic/p2p/message/VersionMessage.js', 
        './src/generic/consensus/account/Address.js', 
        './src/generic/**/*.js',
        '!./src/generic/utils/indexed-db/**/*.js'])
    .pipe(concat('nimiq.js'))
    .pipe(gulp.dest('./'));
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
