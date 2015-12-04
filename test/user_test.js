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
        browser.assert.text('.passed li:nth-of-type(1)', /\/\/admin.localhost\/subdomain \d[.\d]* ms/);
        browser.assert.text('.passed li:nth-of-type(2)', /error \d[.\d]* ms/);
        browser.assert.text('.passed li:nth-of-type(3)', /expected \d[.\d]* ms/);
        browser.assert.text('.passed li:nth-of-type(4)', /redirect \d[.\d]* ms/);
        browser.assert.text('.passed li:nth-of-type(5)', /status \d[.\d]* ms/);
        browser.assert.text('.passed li:nth-of-type(6)', /timeout \d[.\d]* ms/);
        done();
      });
    });
  });

  describe('redirect', function() {
    describe('to healthy page', function() {
      before(function() {
        server.locals.redirect = '/status';
      });

      it('should see a list of passing tests', function(done) {
        browser.visit(checksURL, function() {
          browser.assert.text('h1', 'Passed');
          browser.assert.text('.passed li:nth-of-type(1)', /\/\/admin.localhost\/subdomain \d[.\d]* ms/);
          browser.assert.text('.passed li:nth-of-type(2)', /error \d[.\d]* ms/);
          browser.assert.text('.passed li:nth-of-type(3)', /expected \d[.\d]* ms/);
          browser.assert.text('.passed li:nth-of-type(4)', /redirect \d[.\d]* ms/);
          browser.assert.text('.passed li:nth-of-type(5)', /status \d[.\d]* ms/);
          browser.assert.text('.passed li:nth-of-type(6)', /timeout \d[.\d]* ms/);
          done();
        });
      });

      after(function() {
        server.locals.redirect = false;
      });
    });

    describe('to page with errors', function() {
      before(function() {
        server.locals.redirect = '/error';
        server.locals.error    = true;
      });

      it('should see a failed test', function(done) {
        browser.visit(checksURL, function() {
          browser.assert.text('h1', 'FailedPassed');
          browser.assert.elements('.failed li', 2);
          browser.assert.text('.failed li:nth-of-type(2)', /redirect => socket hang up \d[.\d]* ms/);
          browser.assert.elements('.passed li', 4);
          done();
        });
      });

      after(function() {
        server.locals.redirect = false;
        server.locals.error    = false;
      });
    });

    describe('loop', function() {
      before(function() {
        server.locals.redirect = '/redirect';
      });

      it('should see a failed test', function(done) {
        browser.visit(checksURL, function() {
          browser.assert.text('h1', 'FailedPassed');
          browser.assert.text('.failed li:nth-of-type(1)', /redirect => too many redirects \d[.\d]* ms/);
          done();
        });
      });

      after(function() {
        server.locals.redirect = false;
      });
    });

    describe('to a subdomain', function() {
      before(function() {
        server.locals.redirect = 'https://subdomain.localhost/error';
      });

      describe('healthy', function() {
        it('should see a passing test', function(done) {
          browser.visit(checksURL, function() {
            browser.assert.text('h1', 'Passed');
            browser.assert.text('.passed li:nth-of-type(4)', /redirect \d[.\d]* ms/);
            done();
          });
        });

      });

      describe('failing', function() {
        before(function() {
          server.locals.error = true;
        });

        it('should see a failing test', function(done) {
          browser.visit(checksURL, function() {
            browser.assert.text('h1', 'FailedPassed');
            browser.assert.text('.failed li:nth-of-type(2)', /redirect => socket hang up \d[.\d]* ms/);
            done();
          });
        });

        after(function() {
          server.locals.error = false;
        });
      });

      after(function() {
        server.locals.redirect = false;
      });
    });

    describe('to a different domain', function() {
      before(function() {
        server.locals.redirect = 'https://www.google.com';
      });

      it('should see a passing test', function(done) {
        browser.visit(checksURL, function() {
          browser.assert.text('h1', 'Passed');
          browser.assert.text('.passed li:nth-of-type(4)', /redirect \d[.\d]* ms/);
          done();
        });
      });

      after(function() {
        server.locals.redirect = false;
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
        browser.assert.text('.failed li:nth-of-type(1)', /error => socket hang up \d[.\d]* ms/);
        browser.assert.elements('.passed li', 5);
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
        browser.assert.text('.failed li:nth-of-type(1)', /timeout => timeout \d[.\d]* s/);
        browser.assert.elements('.passed li', 5);
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
        browser.assert.text('.failed li:nth-of-type(1)', /status => 400 \d[.\d]* ms/);
        browser.assert.elements('.passed li', 5);
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
        browser.assert.text('.failed li:nth-of-type(1)', /expected => body \d[.\d]* ms/);
        browser.assert.elements('.passed li', 5);
        done();
      });
    });

    after(function() {
      server.locals.expected = 'Expected to see foo and bar';
    });
  });


  describe('subdomain not accessible', function() {
    before(function() {
      server.locals.subdomain = '';
    });

    it('should see a failed test', function(done) {
      browser.visit(checksURL, function() {
        browser.assert.text('h1', 'FailedPassed');
        browser.assert.elements('.failed li', 1);
        browser.assert.text('.failed li:nth-of-type(1)', /\/\/admin.localhost\/subdomain => 404 \d[.\d]* ms/);
        browser.assert.elements('.passed li', 5);
        done();
      });
    });

    after(function() {
      server.locals.subdomain = 'admin';
    });
  });

});

