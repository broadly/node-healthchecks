'use strict';
const express       = require('express');
const healthchecks  = require('../..');
const Path          = require('path');


const server = express();
module.exports = server;

server.enable('trust proxy');

// We have two test suites that want to run the same test server.
//
// Instead of calling listen() they call ready(), and get notified when the
// server is ready to receive requests.  Server only started once.
let listening = false;
server.ready = function(callback) {
  if (listening)
    setImmediate(callback);
  else {
    server.listen(3000, function() {
      listening = true;
      callback();
    });
  }
};


server.use('/_healthchecks', healthchecks({
  filename: Path.join(__dirname, '../checks/default'),
  onFailed: function(failed) {
    server.emit('failed', failed);
  }
}));

// Test the response errors
server.locals.error = false;
server.get('/error', function(req, res) {
  if (server.locals.error)
    res.socket.destroy();
  else
    res.status(204).send('');
});

// Test the response timeout
server.locals.timeout = 0;
server.get('/timeout', function(req, res) {
  setTimeout(function() {
    res.send('');
  }, server.locals.timeout);
});

// Test the response has specific status code
server.locals.status = 200;
server.get('/status', function(req, res) {
  res.status(server.locals.status).send('');
});

// Test the response contains expected text
server.locals.expected = 'Expected to see foo and bar';
server.get('/expected', function(req, res) {
  res.send(server.locals.expected);
});

// Test redirects
server.locals.redirect = false;
server.get('/redirect', function(req, res) {
  if (server.locals.redirect)
    res.redirect(server.locals.redirect);
  else
    res.status(204).send('');
});

// Test subdomains
server.locals.subdomain = 'admin';
server.get('/subdomain', function(req, res) {
  const subdomain = req.headers.host.split('.')[0];

  if (subdomain === server.locals.subdomain)
    res.status(200).send('');
  else
    res.status(404).send('');
});

// Test HTTPS
server.get('/ssl-required', function(req, res) {
  if (req.protocol === 'https')
    res.status(200).send('');
  else
    res.status(403).send('');
});
