'use strict';
const assert  = require('assert');
const ms      = require('ms');
const request = require('request');
const server  = require('./helpers/server');


const checksURL = 'http://localhost:3000/_healthchecks';


describe('Pingdom run checks', function() {

  before(function(done) {
    server.ready(done);
  });


  describe('all healthy', function() {

    it('should receive response with status 200', function(done) {
      request(checksURL, function(error, response) {
        assert.equal(response.statusCode, 200);
        done(error);
      });
    });
  });


  describe('URL not accessible', function() {
    before(function() {
      server.locals.error = true;
    });

    it('should receive response with status 500', function(done) {
      request(checksURL, function(error, response) {
        assert.equal(response.statusCode, 500);
        done(error);
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

    it('should receive response with status 500', function(done) {
      this.timeout(ms('4s'));

      request(checksURL, function(error, response) {
        assert.equal(response.statusCode, 500);
        done(error);
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

    it('should receive response with status 500', function(done) {
      request(checksURL, function(error, response) {
        assert.equal(response.statusCode, 500);
        done(error);
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

    it('should receive response with status 500', function(done) {
      request(checksURL, function(error, response) {
        assert.equal(response.statusCode, 500);
        done(error);
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

    it('should receive response with status 500', function(done) {
      request(checksURL, function(error, response) {
        assert.equal(response.statusCode, 500);
        done(error);
      });
    });

    after(function() {
      server.locals.subdomain = 'admin';
    });
  });


});
