describe('JSHint', function () {
    var cacheName = 'gulpJasmineLivereloadTaskCache',
        toBeEmptyMessageMatchers = {
            currentVersion: {
                toBeEmptyMessage: function () {
                    return {
                        compare: function (message) {
                            return {
                                pass: !message,
                                message: message
                            }
                        }
                    }
                }
            },
            '<=1.3': {
                toBeEmptyMessage: function () {
                    var self = this;
                    this.message = function () {
                        return [self.actual];
                    };
                    return !this.actual;
                }
            }
        },
        hasStorage = typeof (Storage) !== "undefined",
        cache = hasStorage && (JSON.parse(localStorage.getItem(cacheName)) || {});

    function cacheJSHintOptions() {
        cache.options = gulpJasmineLivereloadTask.options.jshint.options;

        localStorage.setItem(cacheName, JSON.stringify(cache));
    }

    function initTestsCache() {
        if (JSON.stringify(cache.options) !== JSON.stringify(gulpJasmineLivereloadTask.options.jshint.options)) {
            cache = {};
        }
    }

    function getCachedErrors(file) {
        var fileData = cache && cache[file.path],
            cachedErrors;

        if (fileData && fileData.timeStamp === file.timeStamp) {
            cachedErrors = fileData.errors;
        }

        return cachedErrors;
    }

    function cacheErrors(file, errors) {
        if (hasStorage) {
            cache[file.path] = {
                timeStamp: file.timeStamp,
                errors: errors
            };

            localStorage.setItem(cacheName, JSON.stringify(cache));
        }
    }

    function addEmptyMessageMatcher(jasmineVersion, test) {
        if (jasmineVersion > '1.3') {
            jasmine.addMatchers(toBeEmptyMessageMatchers.currentVersion);
        } else {
            test.addMatchers(toBeEmptyMessageMatchers['<=1.3']);
        }
    }

    function testFile(file) {
        it(file.path, function () {
            var errors;

            addEmptyMessageMatcher(gulpJasmineLivereloadTask.options.jasmine, this);

            errors = getCachedErrors(file);

            if (!errors) {
                console.log('Running jshint on "' + file.path + '"');
                JSHINT(decodeURI(file.source), gulpJasmineLivereloadTask.options.jshint.options);
                errors = JSHINT.errors;
            }

            errors.forEach(function (error) {
                expect('line ' + error.line + ' - ' + error.reason).toBeEmptyMessage();
            });

            if (errors.length <= 0) {
                expect('').toBeEmptyMessage();
            }

            cacheErrors(file, errors);
        });
    }

    function runTests() {
        if (cache) {
            initTestsCache();
            cacheJSHintOptions();
        }

        gulpJasmineLivereloadTask.sources.forEach(testFile);
    }

    runTests();
});
