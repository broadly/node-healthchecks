const Browser = require('zombie');
const ms      = require('ms');
const server  = require('./helpers/server');


const checksURL = 'http://localhost:3000/_healthchecks';


describe('User runs checks', function() {

  const browser = Browser.create();

  before(function(done) {
    server.ready(done);
  });

  describe('all healthy', function() {

    it('should see a list of passing tests', function(done) {
      browser.visit(checksURL, function() {
        browser.assert.text('h1', 'Passed');
        browser.assert.text('.passed li:nth-of-type(1)', 'http://localhost:3000/error');
        browser.assert.text('.passed li:nth-of-type(2)', 'http://localhost:3000/expected');
        browser.assert.text('.passed li:nth-of-type(3)', 'http://localhost:3000/status');
        browser.assert.text('.passed li:nth-of-type(4)', 'http://localhost:3000/timeout');
        done();
      });
    });
  });


  describe('URL not accessible', function() {
    before(function() {
      server.locals.error = true;
    });

    it('should see a failed test', function(done) {
      browser.visit(checksURL, function() {
        browser.assert.text('h1', 'FailedPassed');
        browser.assert.elements('.failed li', 1);
        browser.assert.text('.failed li:nth-of-type(1)', 'http://localhost:3000/error => socket hang up');
        browser.assert.elements('.passed li', 3);
        done();
      });
    });

    after(function() {
      server.locals.error = false;
    });
  });


  describe('response times out', function() {
    before(function() {
      server.locals.timeout = ms('3s');
    });

    it('should see a failed test', function(done) {
      this.timeout(ms('4s'));

      browser.visit(checksURL, function() {
        browser.assert.text('h1', 'FailedPassed');
        browser.assert.elements('.failed li', 1);
        browser.assert.text('.failed li:nth-of-type(1)', 'http://localhost:3000/timeout => timeout');
        browser.assert.elements('.passed li', 3);
        done();
      });
    });

    after(function() {
      server.locals.timeout = 0;
    });
  });


  describe('response is 400', function() {
    before(function() {
      server.locals.status = 400;
    });

    it('should see a failed test', function(done) {
      browser.visit(checksURL, function() {
        browser.assert.text('h1', 'FailedPassed');
        browser.assert.elements('.failed li', 1);
        browser.assert.text('.failed li:nth-of-type(1)', 'http://localhost:3000/status => 400');
        browser.assert.elements('.passed li', 3);
        done();
      });
    });

    after(function() {
      server.locals.status = 200;
    });
  });


  describe('response missing expected content', function() {
    before(function() {
      server.locals.expected = 'Expected to see foo and also bar';
    });

    it('should see a failed test', function(done) {
      browser.visit(checksURL, function() {
        browser.assert.text('h1', 'FailedPassed');
        browser.assert.elements('.failed li', 1);
        browser.assert.text('.failed li:nth-of-type(1)', 'http://localhost:3000/expected => body');
        browser.assert.elements('.passed li', 3);
        done();
      });
    });

    after(function() {
      server.locals.expected = 'Expected to see foo and bar';
    });
  });


});

