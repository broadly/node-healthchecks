'use strict';
const assert        = require('assert');
const healthchecks  = require('..');
const Path          = require('path');
const request       = require('request');
const server        = require('./helpers/server');


describe('Empty checks file', function() {

  before(function(done) {
    const filename = Path.join(__dirname, 'checks/empty');
    server.use('/_healthchecks.empty', healthchecks(filename));
    server.ready(done);
  });


  it('should receive response with status 404', function(done) {
    request('http://localhost:3000/_healthchecks.empty', function(error, response) {
      assert.equal(response.statusCode, 404);
      done(error);
    });
  });

});


describe('Missing checks file', function() {

  it('should fail setting up middleware', function(done) {
    assert.throws(function() {
      const filename = Path.join(__dirname, 'checks/invalid');
      server.use('/_healthchecks.invalid', healthchecks(filename));
    });
    done();
  });

});
