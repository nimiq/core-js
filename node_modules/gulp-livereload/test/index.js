'use strict';

var gutil = require('gulp-util');
var es = require('event-stream');
var minilr = require('mini-lr');
var glr = require('../index.js');
var sinon = require('sinon');
var assert = require('assert');

var cwd = process.cwd();
var file = new gutil.File({ base: cwd, cwd: cwd, path: cwd + '/style.css' });
var keys = ['basePath', 'key', 'cert', 'start', 'quiet', 'reloadPage'];
var srv, log;

describe('gulp-livereload', function() {
  beforeEach(function() {
    srv = sinon.stub(minilr, 'Server');
    log = sinon.stub(gutil, 'log');
  });
  afterEach(function() {
    keys.forEach(function(key) {
      delete glr.options[key];
    });
    glr.server = null;
    srv.restore();
    log.restore();
  });
  it('does not work', function(done) {
    var spy = sinon.spy();
    srv.returns({ changed: spy , listen: function() {}});
    es.readable(function(count, next) {
        this.emit('data', file);
        this.emit('end');
        next();
      })
      .pipe(glr({ basePath: cwd }))
      .on('end', function() {
        assert(spy.notCalled);
        done();
      });
  });
  it('works', function(done) {
    var spy = sinon.spy();
    srv.returns({ changed: spy , listen: function() {}});
    var lr = glr();
    glr.listen();
    es.readable(function(count, next) {
        this.emit('data', file);
        this.emit('end');
        next();
      })
      .pipe(lr)
      .on('end', function() {
        assert(spy.calledWith(files(file.path)));
        done();
      });
  });
  it('listen callback', function() {
    var spy = sinon.spy()
    srv.returns({ listen: function(port, host, cb) {
      cb();
    }})
    glr.listen(spy)
    assert(spy.called)
  })
  it('middleware', function() {
    assert(typeof glr.middleware === 'function');
  });
  it('non-standard port', function() {
    var spy = sinon.spy();
    srv.returns({ listen: spy });

    glr.server = null;
    glr.listen(2453);
    assert(spy.firstCall.calledWith(2453));

    glr.server = null;
    glr.listen({ port: 9754 });
    assert(spy.secondCall.calledWith(9754));
  });
  it('https', function() {
    var https = require('https');
    var spy = sinon.spy(https, 'createServer');
    var read = require('fs').readFileSync;
    var opts  = {
      key: read(__dirname + '/dev.key'),
      cert: read(__dirname + '/dev.pem')
    };
    srv.restore();
    glr.listen(opts);
    assert(spy.called);
    glr.server.close();
  });
  it('vinyl', function() {
    var spy = sinon.spy();
    srv.returns({ changed: spy, listen: function() {} });
    glr.listen();
    glr.changed(file);
    assert(spy.calledWith(files(file.path)));
  });
  it('reload', function() {
    var spy = sinon.spy();
    srv.returns({ changed: spy, listen: function() {} });
    glr.listen();

    glr.reload();
    assert(spy.firstCall.calledWith(files(glr.options.reloadPage)));

    glr.reload('not-index.html');
    assert(spy.secondCall.calledWith(files('not-index.html')));
  });
  it('option: basePath', function(done) {
    var spy = sinon.spy();
    srv.returns({ changed: spy , listen: function() {}});
    glr.listen();
    es.readable(function(count, next) {
        this.emit('data', file);
        this.emit('end');
        next();
      })
      .pipe(glr({ basePath: process.cwd() }))
      .on('end', function() {
        assert(spy.calledWith(files('/style.css')));
        done();
      });
  });
  it('option: start', function(done) {
    var spy = sinon.spy();
    srv.returns({ changed: spy , listen: function() {}});
    es.readable(function(count, next) {
        this.emit('data', file);
        this.emit('end');
        next();
      })
      .pipe(glr({ start: true }))
      .on('end', function() {
        assert(spy.calledWith(files(file.path)));
        done();
      });
  });
  it('option: quiet', function() {
    var spy = sinon.spy();
    var logSpy = sinon.spy();
    log.returns(logSpy);
    srv.returns({ changed: spy, listen: function() {} });
    glr.listen({ quiet: true });
    glr.changed(file);
    assert(spy.calledWith(files(file.path)));
    assert(logSpy.notCalled);
  });
  it('option: reloadPage', function() {
    var spy = sinon.spy();
    srv.returns({ changed: spy, listen: function() {} });
    glr.listen({ reloadPage: 'not-index.html' });
    glr.reload();
    assert(spy.calledWith(files('not-index.html')));
  });
});

function files(filePath) {
  return { body: { files: [ filePath ] } };
}
