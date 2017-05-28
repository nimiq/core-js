const gulp = require('gulp');
const jasmine = require('gulp-jasmine-livereload-task');
const concat = require('gulp-concat');
const sourcemaps = require('gulp-sourcemaps');
const babel = require('gulp-babel');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const rename = require('gulp-rename');
const connect = require('gulp-connect');
const util = require("gulp-util");

const sources = {
    browser: [
        './src/main/platform/browser/Class.js',
        './src/main/generic/utils/Observable.js',
        './src/main/platform/browser/database/BaseTypedDB.js',
        './src/main/platform/browser/database/TypedDB.js',
        './src/main/platform/browser/**/*.js',
        './src/main/generic/utils/**/*.js',
        './src/main/generic/consensus/primitive/Primitive.js',
        './src/main/generic/consensus/primitive/**/*.js',
        './src/main/generic/consensus/block/BlockHeader.js',
        './src/main/generic/consensus/block/BlockBody.js',
        './src/main/generic/consensus/block/BlockUtils.js',
        './src/main/generic/network/struct/*.js',
        './src/main/generic/network/message/Message.js',
        './src/main/generic/network/message/*Message.js',
        './src/main/generic/consensus/account/Address.js',
        './src/main/generic/**/*.js'
    ],
    node: [
        './src/main/generic/utils/**/*.js',
        './src/main/generic/consensus/primitive/Primitive.js',
        './src/main/generic/consensus/primitive/**/*.js',
        './src/main/generic/consensus/block/BlockHeader.js',
        './src/main/generic/consensus/block/BlockBody.js',
        './src/main/generic/network/message/Message.js',
        './src/main/generic/network/message/VersionMessage.js',
        './src/main/generic/consensus/account/Address.js',
        './src/main/generic/**/*.js',
        '!./src/main/generic/utils/indexed-db/**/*.js'
    ],
    test: [
        'src/test/specs/**/Dummy.spec.js',
        'src/test/specs/**/*.spec.js'
    ],
    sectest: [
        'sectests/**/Dummy.sectest.js',
        'sectests/**/*.sectest.js'
    ],
    all: [
        './src/main/**/*.js',
        './src/test/**/*.js',
        '!./src/**/node_modules/**/*.js'
    ]
};

gulp.task('test', ['watch'], function () {
    gulp.run(jasmine({
        files: [
            'dist/babel-runtime.js',
            'dist/nimiq.js'
        ].concat(sources.test)
    }));
});

gulp.task('sectest', function () {
    gulp.run(jasmine({
        files: sources.browser.concat(sources.sectest)
    }));
});

const babel_config = {
    plugins: ['transform-runtime'],
    presets: [['env', {
        targets: {
            browsers: [
                'last 3 Chrome versions',
                'last 3 Firefox versions',
                'last 2 Edge versions',
                'last 1 Safari versions',
                'last 1 iOS versions'
            ]
        }
    }]]
};

gulp.task('build', ['browserify-babel-runtime'], function () {
    return gulp.src(sources.browser)
        .pipe(sourcemaps.init())
        .pipe(concat('nimiq.js'))
        .pipe(babel(babel_config))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'))
        .pipe(connect.reload());
});

gulp.task('browserify-babel-runtime', function () {
    return browserify([], {
        require: [
            'babel-runtime/core-js/object/freeze',
            'babel-runtime/core-js/number/is-integer',
            'babel-runtime/core-js/object/keys',
            'babel-runtime/core-js/json/stringify',
            'babel-runtime/core-js/number/max-safe-integer',
            'babel-runtime/regenerator',
            'babel-runtime/helpers/asyncToGenerator',
            'babel-runtime/core-js/promise',
            'babel-runtime/core-js/get-iterator'
        ]
    }).bundle()
        .pipe(source('dist/babel-runtime.src.js'))
        .pipe(rename('babel-runtime.js'))
        .pipe(gulp.dest('dist'));
});

gulp.task('build-node', function () {
    return gulp.src(sources.node)
        .pipe(sourcemaps.init())
        .pipe(concat('nimiq.js'))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('./'));
});

gulp.task('jscs', function () {
    const jscs = require('gulp-jscs');
    return gulp.src(sources.all)
        .pipe(jscs())
        .pipe(jscs.reporter());
});

gulp.task('eslint', function () {
    const eslint = require('gulp-eslint');
    return gulp.src(sources.all)
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('watch', ['build'], function () {
    return gulp.watch(sources.browser, ['build']);
});

gulp.task('serve', ['watch'], function () {
    connect.server({
        livereload: true,
        serverInit: function () {
            util.log(util.colors.blue('Nimiq Blockchain Cockpit will be at http://localhost:8080/clients/browser/'));
        }
    });
});

// gulp.task('test-build', ['watch'], function() {
//     gulp.run(jasmine({
//         files: [paths.build, paths.test]
//     }));
// });

gulp.task('default', ['build', 'serve']);
