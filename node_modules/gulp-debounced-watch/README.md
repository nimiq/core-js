# [gulp](https://github.com/gulpjs/gulp)-debounced-watch [![NPM version][npm-image]][npm-url][![Dependency Status][depstat-image]][depstat-url]

File watcher that uses super-fast [chokidar](https://github.com/paulmillr/chokidar) and emits vinyl objects and debounces the files individually.

## Installation

Run `npm install --save-dev gulp-debounced-watch`.

## Usage

```js
var gulp = require('gulp'),
    watch = require('gulp-debounced-watch');

gulp.task('stream', function () {
    return gulp.src('css/**/*.css')
        .pipe(watch('css/**/*.css'))
        .pipe(gulp.dest('build'));
});

gulp.task('callback', function (cb) {
    watch('css/**/*.css', function () {
        gulp.src('css/**/*.css')
            .pipe(watch('css/**/*.css'))
            .on('end', cb);
    });
});

gulp.task('callback2', function (cb) {
    watch('css/**/*.css', function(vinyl) {
        gulp.src(vinyl.path)
            .pipe(gulp.dest('build'));
    });
});
```

> __Protip:__ until gulpjs 4.0 is released, you can use [gulp-plumber](https://github.com/floatdrop/gulp-plumber) to prevent stops on errors.

## API

### debouncedWatch(glob, [options, callback])

Creates a watcher that will spy on files that are matched by `glob` which can be a
glob string or array of glob strings.

Returns a pass through stream that will emit vinyl files
(with additional `event` property) that corresponds to event on file-system.

#### Callback `function(vinyl)`

This function is called when events happen on the file-system.
All incoming files that are piped in are grouped and passed to the `events` stream as is.

 * `vinyl` — is [vinyl](https://github.com/wearefractal/vinyl) object that corresponds to the file that caused the event. Additional `event` field is added to determine what caused changes.

Possible events:

 * `add` - file was added to watch or created
 * `change` - file was changed
 * `unlink` - file was deleted

#### Options

This object is passed to the [`chokidar` options](https://github.com/paulmillr/chokidar#api) directly. Options for [`gulp.src`](https://github.com/gulpjs/gulp/blob/master/docs/API.md#options) are also available. If you do not want content from `watch`, then add `read: false` to the `options` object.

#### options.[ignoreInitial](https://github.com/paulmillr/chokidar#path-filtering)
Type: `Boolean`  
Default: `true`

> Indicates whether chokidar should ignore the initial add events or not.

#### options.events
Type: `Array`  
Default: `['add', 'change', 'unlink']`

List of events, that should be watched by gulp-watch. Contains [event names from chokidar](https://github.com/paulmillr/chokidar#events).

#### options.base
Type: `String`  
Default: `undefined`

Use explicit base path for files from `glob`. Read more about `base` and `cwd` in [gulpjs docs](https://github.com/gulpjs/gulp/blob/master/docs/API.md#options).

#### options.name
Type: `String`  
Default: `undefined`

Name of the watcher. If it is present in options, you will get more readable output.

#### options.verbose
Type: `Boolean`  
Default: `false`

This option will enable verbose output.

#### options.readDelay
Type: `Number`  
Default: `10`

Wait for `readDelay` milliseconds before reading the file.

#### options.debounceImmediate
Type: `Boolean`
Default: `false`

This option when set will issue a callback on the first event.

#### options.debounceTimeout
Type: `Number`
Default: `1000`

The number of milliseconds to debounce.

### Methods

Returned `Stream` from constructor has some useful methods:

 * `add(path / paths)`
 * `unwatch(path / paths)`
 * `close()`

### Events

All events from [chokidar](npmjs.com/chokidar):

 * `add`, `change`, `unlink`, `addDir`, `unlinkDir`, `error`, `ready`, `raw`


## License

MIT (c) 2015 Robert McKee (robertjunk@mckee.org)

[npm-url]: https://npmjs.org/package/gulp-debounced-watch
[npm-image]: http://img.shields.io/npm/v/gulp-debounced-watch.svg?style=flat

[depstat-url]: https://david-dm.org/kingmotley/gulp-debounced-watch
[depstat-image]: http://img.shields.io/david/kingmotley/gulp-debounced-watch.svg?style=flat