const assert  = require('assert');
const ms      = require('ms');
const request = require('request');
const server  = require('./helpers/server');


const checksURL = 'http://localhost:3000/_healthchecks';


describe('Runs checks', function() {

  before(function(done) {
    server.ready(done);
  });

  describe('all healthy', function() {

    function notified() {
      assert(false, 'Should not have called onFailed');
    }

    before(function() {
      server.addListener('failed', notified);
    });

    it('should not be notified', function(done) {
      request(checksURL, function() {
        done();
      });
    });

    after(function() {
      server.removeListener('failed', notified);
    });
  });


  describe('URL not accessible', function() {
    before(function() {
      server.locals.error = true;
    });

    it('should be notified of a failed test', function(done) {
      server.once('failed', function(failed) {
        assert.equal(failed.length, 1);
        assert.equal(failed[0].url, '/error');
        assert.equal(failed[0].reason, 'error');

        assert(failed[0].error);
        assert(!failed[0].timeout);
        assert(!failed[0].statusCode);
        assert(!failed[0].body);

        assert.equal(failed[0].toString(), '/error => socket hang up');
        done();
      });
      request(checksURL);
    });

    after(function() {
      server.locals.error = false;
    });
  });


  describe('response times out', function() {
    before(function() {
      server.locals.timeout = ms('3s');
    });

    it('should be notified of a failed test', function(done) {
      this.timeout(ms('4s'));

      server.once('failed', function(failed) {
        assert.equal(failed.length, 1);
        assert.equal(failed[0].url, '/timeout');
        assert.equal(failed[0].reason, 'timeout');

        assert(!failed[0].error);
        assert(failed[0].timeout);
        assert(!failed[0].statusCode);
        assert(!failed[0].body);

        assert.equal(failed[0].toString(), '/timeout => timeout');
        done();
      });

      request(checksURL);
    });

    after(function() {
      server.locals.timeout = 0;
    });
  });


  describe('response is 400', function() {
    before(function() {
      server.locals.status = 400;
    });

    it('should be notified of a failed test', function(done) {
      server.once('failed', function(failed) {
        assert.equal(failed.length, 1);
        assert.equal(failed[0].url, '/status');
        assert.equal(failed[0].reason, 'statusCode');

        assert(!failed[0].error);
        assert(!failed[0].timeout);
        assert.equal(failed[0].statusCode, 400);
        assert(!failed[0].body);

        assert.equal(failed[0].toString(), '/status => 400');
        done();
      });
      request(checksURL);
    });

    after(function() {
      server.locals.status = 200;
    });
  });


  describe('response missing expected content', function() {
    before(function() {
      server.locals.expected = 'Expected to see foo and also bar';
    });

    it('should be notified of a failed test', function(done) {
      server.once('failed', function(failed) {
        assert.equal(failed.length, 1);
        assert.equal(failed[0].url, '/expected');
        assert.equal(failed[0].reason, 'body');

        assert(!failed[0].error);
        assert(!failed[0].timeout);
        assert.equal(failed[0].statusCode, 200);
        assert.equal(failed[0].body, 'Expected to see foo and also bar');

        assert.equal(failed[0].toString(), '/expected => body');
        done();
      });
      request(checksURL);
    });

    after(function() {
      server.locals.expected = 'Expected to see foo and bar';
    });
  });


});


