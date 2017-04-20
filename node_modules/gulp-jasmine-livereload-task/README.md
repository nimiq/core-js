# gulp-jasmine-livereload-task

A [gulp](http://gulpjs.com/) plugin that runs [Jasmine](http://jasmine.github.io/) tests in browser with [livereload](http://livereload.com/). The package will try to use the latests local `jasmine-core` if exists. If not it will use an embedded version.

![alt tag](https://raw.githubusercontent.com/mucsi96/gulp-jasmine-livereload-task/master/img/jasmine.png)
![alt tag](https://raw.githubusercontent.com/mucsi96/gulp-jasmine-livereload-task/master/img/jasmine-mobile.png)

## Installation

```
$ npm install --save-dev jasmine-core gulp-jasmine-livereload-task
```

## Basic usage

This is a sample gulpfile.js

```javascript
var gulp    = require('gulp'),
    jasmine = require('gulp-jasmine-livereload-task');

gulp.task('default', jasmine({
    files: ['./src/**/*.js', './spec/**/*.js']
}));

```

## Watch debounce

This package is using [`gulp-debounced-watch`](https://www.npmjs.com/package/gulp-debounced-watch) for watching for file changes. Debounce options can be set in options

```javascript
var gulp    = require('gulp'),
    jasmine = require('gulp-jasmine-livereload-task');

gulp.task('default', jasmine({
    files: ['./src/**/*.js', './spec/**/*.js'],
    watch: {
        options: {
            debounceTimeout: 1000, //The number of milliseconds to debounce.
            debounceImmediate: true //This option when set will issue a callback on the first event.
        }
    }
}));
```

## Using with jshint

The package will try to use the latests local ```jshint``` if exists. If not it will use an embedded version.

```
$ npm install --save-dev jshint
```

```javascript
var gulp    = require('gulp'),
    jasmine = require('gulp-jasmine-livereload-task');

gulp.task('default', jasmine({
    files: ['./src/**/*.js', './spec/**/*.js'],
    jshint: {
        files: ['./src/**/*.js', './spec/**/*.js'],
        options: {
            curly: true,
            white: true,
            indent: 2
        }
    }
}));

```

## Using with webserving

```javascript
var gulp    = require('gulp'),
    jasmine = require('gulp-jasmine-livereload-task');

gulp.task('default', jasmine({
    files: ['./src/**/*.js', './spec/**/*.js'],
    host: 'mucsi-laptop',
    port: 8080,
}));

```

### Options

These options can be set through `jasmine(options)`.

```
files               Source files and specs
jasmine             Embedded jasmine version. Default: 2.2. Embedded versions: 1.3, 2.0, 2.1, 2.2
livereload          Livereload server port. Default: 35729
host                Host name. If need to be served
port                Port number. If need to be served
staticAssetsPath    The root path of the static files served by the webserver, by default it is the plugin folder
specRunner          The path of the SpecRunner.html file, by default it is the plugin folder / SpecRunner.html
jshint.files        Files to be checked by jshint
jshint.options      Options used by jshint
jshint.version      Embedded Jshint version. Default: 2.6. Embedded versions: 2.6
watch.options       Options used by gulp-debounced-watch package used for watching for file changes
```

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)
