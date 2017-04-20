gulp-livereload
===

[![Build Status][1]][2] [![Code Climate][7]][6] [![Livereload downloads][3]][4] [![Tag][9]][8] [![MIT Licensed][5]](#license)

[1]: http://img.shields.io/travis/vohof/gulp-livereload/master.svg?style=flat
[2]: https://travis-ci.org/vohof/gulp-livereload

[3]: http://img.shields.io/npm/dm/gulp-livereload.svg?style=flat
[4]: https://www.npmjs.com/package/gulp-livereload

[5]: http://img.shields.io/badge/license-MIT-blue.svg?style=flat

[6]: https://codeclimate.com/github/vohof/gulp-livereload
[7]: https://img.shields.io/codeclimate/coverage/github/vohof/gulp-livereload.svg?style=flat

[8]: https://github.com/vohof/gulp-livereload/releases
[9]: https://img.shields.io/github/tag/vohof/gulp-livereload.svg?style=flat


A lightweight [gulp](https://github.com/gulpjs/gulp) plugin for livereload best used with the [livereload chrome extension](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei).

- [Installation](#install)
- [Upgrade Notice](#3x-upgrade-notice)
- [Usage](#usage)
- [API](#api--variables)
 - [Options](#options-optional)
 - [livereload](#livereloadoptions)
 - [livereload.listen](#livereloadlistenoptions)
 - [livereload.changed](#livereloadchangedpath)
 - [livereload.reload](#livereloadreloadfile)
 - [livereload.middleware](#livereloadmiddleware)
 - [livereload.server](#livereloadserver)
- [Debugging](#debugging)
- [License](#license)

Install
---

```
npm install --save-dev gulp-livereload
```

3.x Upgrade Notice
---

`gulp-livereload` will not automatically listen for changes. You now have to manually call `livereload.listen` unless you set the option `start`:

```js
livereload({ start: true })
```

Usage
---

```javascript
var gulp = require('gulp'),
    less = require('gulp-less'),
    livereload = require('gulp-livereload');

gulp.task('less', function() {
  gulp.src('less/*.less')
    .pipe(less())
    .pipe(gulp.dest('css'))
    .pipe(livereload());
});

gulp.task('watch', function() {
  livereload.listen();
  gulp.watch('less/*.less', ['less']);
});
```

**See [examples](examples)**.

API & Variables
---

### Options (Optional)

These options can either be set through `livereload.listen(options)` or `livereload(options)`.

```
port                     Server port
host                     Server host
basePath                 Path to prepend all given paths
start                    Automatically start
quiet        false       Disable console logging
reloadPage   index.html  Path to the page the browsers on for a full page reload
```

### livereload([options])

Creates a stream which notifies the livereload server on what changed.

### livereload.listen([options])

Starts a livereload server. It takes an optional options parameter that is the same as the one noted above. Also you dont need to worry with multiple instances as this function will end immidiately if the server is already runing.

### livereload.changed(path)

Alternatively, you can call this function to send changes to the livereload server. You should provide either a simple string or an object, if an object is given it expects the object to have a `path` property.

> NOTE: Calling this function without providing a `path` will do nothing.

### livereload.reload([file])

You can also tell the browser to refresh the entire page. This assumes the page is called `index.html`, you can change it by providing an **optional** `file` path or change it globally with the options `reloadPage`.

###  livereload.middleware

You can also directly access the middleware of the underlying server instance (mini-lr.middleware) for hookup through express, connect, or some other middleware app

### livereload.server

gulp-livereload also reveals the underlying server instance for direct access if needed. The instance is a "mini-lr" instance that this wraps around. If the server is not running then this will be `undefined`.

Debugging
---

Set the `DEBUG` environment variables to `*` to see what's going on


```
$ DEBUG=* gulp <task>
```


License
---

The MIT License (MIT)

Copyright (c) 2014 Cyrus David

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
