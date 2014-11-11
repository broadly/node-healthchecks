const assert        = require('assert');
const healthchecks  = require('..');
const request       = require('request');
const server        = require('./helpers/server');


describe('Empty checks file', function() {

  before(function(done) {
    server.use('/_healthchecks.empty', healthchecks(__dirname + '/checks/empty'));
    server.ready(done);
  });


  it('should receive response with status 404', function(done) {
    request('http://localhost:3000/_healthchecks.empty', function(error, response) {
      assert.equal(response.statusCode, 404);
      done();
    });
  });

});


describe('Missing checks file', function() {

  it('should fail setting up middleware', function(done) {
    assert.throws(function() {
      server.use('/_healthchecks.invalid', healthchecks(__dirname + '/checks/invalid'));
    });
    done();
  });

});
