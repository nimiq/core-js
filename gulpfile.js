const gulp = require('gulp');
const jasmine = require('gulp-jasmine-livereload-task');
const concat = require('gulp-concat');

gulp.task('test', function () {
    gulp.run(jasmine({
        files: [
            './src/main/platform/browser/Class.js',
            './src/main/generic/utils/Observable.js',
            './src/main/platform/browser/**/*.js',
            './src/main/generic/utils/**/*.js',
            './src/main/generic/consensus/primitive/Primitive.js',
            './src/main/generic/consensus/primitive/**/*.js',
            './src/main/generic/consensus/Policy.js',
            './src/main/generic/consensus/block/BlockUtils.js',
            './src/main/generic/consensus/block/BlockHeader.js',
            './src/main/generic/consensus/block/BlockBody.js',
            './src/main/generic/network/struct/*.js',
            './src/main/generic/network/message/Message.js',
            './src/main/generic/network/message/*Message.js',
            './src/main/generic/consensus/account/Address.js',
            './src/main/generic/**/*.js',
            'src/test/specs/**/Dummy.spec.js',
            'src/test/specs/**/*.spec.js'
        ]
    }));
});

gulp.task('sectest', function () {
    gulp.run(jasmine({
        files: [
            'src/main/generic/utils/indexed-db/indexed-db.js',
            'src/main/generic/utils/indexed-db/*.js',
            'src/main/generic/utils/**/*.js',
            'src/main/generic/consensus/primitive/Primitive.js',
            'src/main/generic/consensus/primitive/*.js',
            'src/main/generic/consensus/account/*.js',
            'src/main/generic/consensus/block/BlockBody.js',
            'src/main/generic/consensus/block/BlockHeader.js',
            'src/main/generic/consensus/block/*.js',
            'src/main/generic/network/message/VerAckMessage.js',
            'src/main/generic/network/message/Message.js',
            'src/main/generic/network/message/*Message.js',
            'src/main/generic/network/message/*.js',
            'src/main/generic/network/**/*.js',
            'src/main/generic/*/**/*.js',
            'src/main/generic/*.js',
            'sectests/**/Dummy.sectest.js',
            'sectests/**/*.sectest.js'
        ]
    }));
});


gulp.task('build', function () {
    return gulp.src([
        './src/main/platform/browser/Class.js',
        './src/main/generic/utils/Observable.js',
        './src/main/platform/browser/**/*.js',
        './src/main/generic/utils/**/*.js',
        './src/main/generic/consensus/primitive/Primitive.js',
        './src/main/generic/consensus/primitive/**/*.js',
        './src/main/generic/consensus/block/BlockHeader.js',
        './src/main/generic/consensus/block/BlockBody.js',
        './src/main/generic/network/struct/*.js',
        './src/main/generic/network/message/Message.js',
        './src/main/generic/network/message/*Message.js',
        './src/main/generic/consensus/account/Address.js',
        './src/main/generic/**/*.js'])
    .pipe(concat('dist/nimiq.js'))
    .pipe(gulp.dest('./'));
});

gulp.task('build-node', function () {
    return gulp.src([
        './src/main/generic/utils/**/*.js',
        './src/main/generic/consensus/primitive/Primitive.js',
        './src/main/generic/consensus/primitive/**/*.js',
        './src/main/generic/consensus/block/BlockHeader.js',
        './src/main/generic/consensus/block/BlockBody.js',
        './src/main/generic/network/message/Message.js',
        './src/main/generic/network/message/VersionMessage.js',
        './src/main/generic/consensus/account/Address.js',
        './src/main/generic/**/*.js',
        '!./src/main/generic/utils/indexed-db/**/*.js'])
    .pipe(concat('nimiq.js'))
    .pipe(gulp.dest('./'));
});

gulp.task('jscs', function () {
    const jscs = require('gulp-jscs');
    return gulp.src(['./src/main/**/*.js', './src/test/**/*.js'])
    .pipe(jscs())
    .pipe(jscs.reporter());
});

gulp.task('eslint', function () {
    const eslint = require('gulp-eslint');
    return gulp.src(['./src/main/**/*.js', './src/test/**/*.js', '!./src/**/node_modules/**/*.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('default', ['eslint', 'build']);

// gulp.task('watch', function() {
//     gulp.run('build');
//     gulp.watch(paths.src, ['build']);
// });

// gulp.task('test-build', ['watch'], function() {
//     gulp.run(jasmine({
//         files: [paths.build, paths.test]
//     }));
// });
