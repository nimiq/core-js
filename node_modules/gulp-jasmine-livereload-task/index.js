var parentRequire = require('parent-require'),
    gulp = parentRequire('gulp'),
    extend = require('extend'),
    fs = require('fs'),
    path = require('path'),
    watch = require('gulp-debounced-watch'),
    inject = require('gulp-inject'),
    replace = require('gulp-replace'),
    livereload = require('gulp-livereload'),
    webserver = require('gulp-webserver'),
    open = require('open'),
    peerRequire = require('./peer-require'),
    opened,
    template = {
        '1.3': path.resolve(__dirname, 'vendor/jasmine-1.3.1/SpecRunner.html'),
        '2.0': path.resolve(__dirname, 'vendor/jasmine-2.0.2/SpecRunner.html'),
        '2.1': path.resolve(__dirname, 'vendor/jasmine-2.1.3/SpecRunner.html'),
        '2.2': path.resolve(__dirname, 'vendor/jasmine-2.2.0/SpecRunner.html'),
        'peer': path.resolve(__dirname, 'vendor/jasmine-peer/SpecRunner.html')
    },
    jshint = {
        '2.6': path.resolve(__dirname, 'jshint-2.6.0/jshint.js')
    },
    defaults = {
        files: undefined,
        jasmine: '2.2',
        livereload: '35729',
        staticAssetsPath: '.',
        specRunner: 'SpecRunner.html',
        jshint: {
            version: '2.6',
            files: [],
            options: {}
        },
        watch: {
            options: {}
        }
    },
    options;

module.exports = function (opts) {
    var peerJasmine = peerRequire('jasmine-core');

    if (peerJasmine.path) {
        defaults.jasmine = 'peer';
        console.log('Installed Jasmine ' +  peerJasmine.version + ' found');
    } else {
        console.log('No installed Jasmine found. Using embedded one');
    }

    if (opts && opts.jshint && opts.jshint.files && opts.jshint.files.length) {
        var peerJsHint = peerRequire('jshint');
        if (peerJsHint.path) {
            defaults.jshint.version = 'peer';
            jshint.peer = path.resolve(peerJsHint.path, 'dist/jshint.js');
            console.log('Installed Jshint ' + peerJsHint.version + ' found');
        } else {
            console.log('No installed jshint found. Using embedded one');
        }
    }

    options = extend(true, {}, defaults, opts);

    return function () {
        createSpecrunner();
        livereload.listen({
            port: options.livereload
        });
        watch(options.files, options.watch.options, createSpecrunner);
    };
};

function createSpecrunner() {
    var target = gulp.dest('.'),
        specrunner;

    target.on('end', function () {
        if (!opened) {
            if (!options.host) {
                open('file:///' + path.join(path.resolve('.'), 'SpecRunner.html'));
            } else {
                gulp.src(options.staticAssetsPath)
                    .pipe(
                        webserver({
                            open: options.specRunner,
                            host: options.host,
                            port: options.port
                        })
                    );
            }
            opened = true;
        }
    });

    if (!fs.existsSync(template[options.jasmine])) {
        throw new Error('Jasmine version ' + options.jasmine + ' is currently not supported!');
    }

    specrunner = gulp.src(template[options.jasmine])
        .pipe(inject(gulp.src(options.files, {read: false}), {
            addRootSlash: false
        }))
        .pipe(replace(/<!-- options:js -->/g, '<script>var gulpJasmineLivereloadTask = {}; gulpJasmineLivereloadTask.options = JSON.parse(\'' + JSON.stringify(options) + '\');</script>'))
        .pipe(replace(/<!-- livereload:js -->/g, '<script src="http://localhost:' + options.livereload + '/livereload.js"></script>'));

    if (options.jshint.files.length > 0) {
        specrunner = specrunner
            .pipe(replace(/<!-- sources:js -->/g, '<script>gulpJasmineLivereloadTask.sources = [];/*sources:js*//*endinject*/</script>'))
            .pipe(inject(gulp.src(options.jshint.files), {
                name: 'sources',
                addRootSlash: false,
                starttag: '/*sources:js*/',
                endtag: '/*endinject*/',
                transform: function (filePath, file) {
                    var source = encodeURI(file.contents.toString('utf8'));
                    return 'gulpJasmineLivereloadTask.sources.push({path: "' + filePath + '", timeStamp: "' + file.stat.mtime.getTime() + '", source: "' + source + '"});\n';
                }
            }))
            .pipe(replace(/<!-- jshint:js -->/g, '<script src="' + jshint[options.jshint.version] + '"></script>\n<script src="node_modules/gulp-jasmine-livereload-task/jshint-spec.js"></script>'));
    }

    specrunner
        .pipe(target)
        .pipe(livereload());
}
