const Browser = require('zombie');
const ms      = require('ms');
const server  = require('./helpers/server');


const checksURL = 'http://localhost:3000/_healthchecks';


describe('User runs checks', function() {

  const browser = new Browser();

  before(function(done) {
    server.ready(done);
  });

  describe('all healthy', function() {

    it('should see a list of passing tests', function(done) {
      browser.visit(checksURL, function() {
        browser.assert.text('h1', 'Passed');
        browser.assert.text('.passed li:nth-of-type(1)', /http:\/\/localhost\/error \d+\.\d{2} sec/);
        browser.assert.text('.passed li:nth-of-type(2)', /http:\/\/localhost\/expected \d+\.\d{2} sec/);
        browser.assert.text('.passed li:nth-of-type(3)', /http:\/\/localhost\/status \d+\.\d{2} sec/);
        browser.assert.text('.passed li:nth-of-type(4)', /http:\/\/localhost\/timeout \d+\.\d{2} sec/);
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
        browser.assert.text('.failed li:nth-of-type(1)', /^http:\/\/localhost\/error => socket hang up \d+\.\d{2} sec$/);
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
        browser.assert.text('.failed li:nth-of-type(1)', /^http:\/\/localhost\/timeout => timeout \d+\.\d{2} sec$/);
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
        browser.assert.text('.failed li:nth-of-type(1)', /^http:\/\/localhost\/status => 400 \d+\.\d{2} sec$/);
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
        browser.assert.text('.failed li:nth-of-type(1)', /^http:\/\/localhost\/expected => body \d+\.\d{2} sec$/);
        browser.assert.elements('.passed li', 3);
        done();
      });
    });

    after(function() {
      server.locals.expected = 'Expected to see foo and bar';
    });
  });


});

