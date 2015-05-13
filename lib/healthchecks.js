// Exports an Express middleware factory.
//
// Example:
//
//   const healthchecks = require('healthchecks');
//   const CHECKS_FILE = './checks';
//
//   server.use('/_healthchecks', healthchecks(CHECKS_FILE));
//
// If you want to change the check timeout, use named argument:
//
//   const options = {
//     filename: CHECKS_FILE,
//     timeout:  '5s'     // 5 seconds, can also pass duration in milliseconds
//   };
//   server.use('/_healthchecks', healthchecks(options);


const _           = require('lodash');
const assert      = require('assert');
const Promise     = require('bluebird');
const debug       = require('debug')('healthchecks');
const File        = require('fs');
const Handlebars  = require('handlebars');
const HTTP        = require('http');
const ms          = require('ms');
const Path        = require('path');
const URL         = require('url');


// Default timeout for checks; a slow server is a failed server.
const DEFAULT_TIMEOUT = '3s';


// Represents a check outcome with the properties url, reason, etc.
function Outcome(url, expected, error, statusCode, body, elapsed) {
  this.url      = url;
  this.elapsed  = elapsed;
  if (error && error.code === 'ETIMEDOUT') {
    this.reason   = 'timeout';
    this.timeout  = true;
  } else if (error) {
    this.reason   = 'error';
    this.error    = error;
  } else {

    this.statusCode = statusCode;
    this.body       = body;
    if (statusCode < 200 || statusCode >= 400)
      this.reason   = 'statusCode';
    else {

      const allMatching = _.all(expected, function(text) {
        return body.indexOf(text) >= 0;
      });
      if (!allMatching)
        this.reason = 'body';

    }
  }
  this.log();
}


// Log outcome, visible when DEBUG=healthchecks
Outcome.prototype.log = function() {
  switch (this.reason) {
    case 'error': {
      debug('%s: Server responded with error %s', this.url, this.error);
      break;
    }
    case 'timeout': {
      debug('%s: Server response timeout', this.url);
      break;
    }
    case 'statusCode': {
      break;
    }
    case 'body': {
      debug('%s: Server response did not contain expected text', this.url);
      break;
    }
  }
};


// Easy way to log check outcome, shows the URL and the reason check failed
Outcome.prototype.toString = function() {
  switch (this.reason) {
    case 'error': {
      return this.url + ' => ' + this.error.message;
    }
    case 'statusCode': {
      return this.url + ' => ' + this.statusCode;
    }
    case undefined: {
      debug('%s: Server responded with status code %s', this.url, this.statusCode);
      return this.url;
    }
    default: {
      return this.url + ' => ' + this.reason;
    }
  }
};


// Our Handlerbars instance.
const handlebars = Handlebars.create();

// Convert milliseconds to seconds formatted n.nn
handlebars.registerHelper('seconds', function(value) {
  return (value / 1000).toFixed(2);
});


// The check function will run all checks in parallel, and resolve to an object
// with the properties:
// passed  - A list of all check URLs that passed
// failed  - A list of all check URLs that failed
function checkFunction(protocol, hostname, port, requestID) {
  const checks  = this.checks;
  const timeout = this.timeout;

  // Each check resolves into an outcome object
  const allChecks = _.map(checks, function(expected, checkURL) {
    return new Promise(function(resolve) {
      // We need to make an HTTP/S request to the current server, based on the hostname/port passed to us,
      // so the HTTP check would go to http://localhost:80/ or some such URL.

      // Checks have relative URLs, resolve them to absolute URLs
      checkURL          = URL.resolve(protocol + '://localhost/', checkURL);
      const requestURL  = _.assign(URL.parse(checkURL), { host: null, port: port, hostname: hostname });
      const request  = {
        hostname: requestURL.hostname,
        port:     requestURL.port,
        path:     requestURL.path,
        headers:  {
          'Host':         URL.parse(checkURL).hostname,
          'User-Agent':   'Mozilla/5.0 (compatible) Healthchecks http://broadly.com',
          'X-Request-Id': requestID || ''
        }
      };
      const start = Date.now();
      HTTP.get(request)
        .on('response', function(response) {
          const elapsed  = Date.now() - start;
          if (response.statusCode < 200 || response.statusCode >= 400)
            resolve(new Outcome(checkURL, expected, null, response.statusCode, null, elapsed));
          else {
            const buffers = [];
            response.on('data', function(buffer) {
              buffers.push(buffer);
            });
            response.on('end', function() {
              const body = Buffer.concat(buffers).toString();
              resolve(new Outcome(checkURL, expected, null, response.statusCode, body, elapsed));
            });
          }

        })
        .on('error', function(error) {
          const elapsed = Date.now() - start;
          resolve(new Outcome(checkURL, expected, error, null, null, elapsed));
        });

      setTimeout(function() {
        const elapsed = Date.now() - start;
        const error   = new Error('ETIMEDOUT');
        error.code    = 'ETIMEDOUT';
        resolve(new Outcome(checkURL, expected, error, null, null, elapsed));
      }, timeout);
    });
  });


  // Run all checks in parallel
  const allOutcomes = Promise.all(allChecks);

  // Reduce into an object with the passed and failed lists of URLs
  const passedAndFailed = allOutcomes
    .then(function(outcomes) {
      return {
        passed: _.reject(outcomes, 'reason'),
        failed: _.filter(outcomes, 'reason')
      };
    });

  // Returns the promise
  return passedAndFailed;
}


// Read the checks file and returns a check function (see checkFunction).
function readChecks(filename, timeout) {
  const checks = File.readFileSync(filename, 'utf-8')
    .split(/[\n\r]+/)                 // Split into lines
    .map(function(line) {             // Ignore leading/trailing spaces
      return line.trim();
    })
    .filter(function(line) {          // Ignore empty lines
      return line.length;
    })
    .filter(function(line) {          // Ignore comments
      return line[0] !== '#';
    })
    .filter(function(line) {          // Ignore name = value pairs
      return !/^\w+=/.test(line);
    })
    .map(function(line) {             // Split line to URL + expected value
      const match = line.match(/^(\S+)\s*(.*)/);
      //debug('Added check %s %s', match[1], match[2]);
      return {
        url:      match[1],
        expected: match[2]
      };
    })
    .map(function(check) {            // Valid URLs only
      // URLs may be relative to the server, so contain an absolute path
      const url = URL.parse(check.url);
      assert(url.pathname && url.pathname[0] === '/', 'Check URL must have absolute pathname');
      assert(!url.protocol || /^https?:$/.test(url.protocol), 'Check URL may only use HTTP/S protocol');
      return check;
    })
    .reduce(function(memo, check) {
      const url   = check.url;
      memo[url] = memo[url] || [];
      if (check.expected)
        memo[url].push(check.expected);
      return memo;
    }, {});

  // Returns a check function that will use these checks / settings
  const context = {
    checks:   checks,
    timeout:  timeout
  };
  debug('Added %d checks', checks.length);

  return checkFunction.bind(context);
}


// Call this function to configure and return the middleware.
module.exports = function healthchecks(options) {
  assert(options, 'Missing options');

  // Pass filename as first argument or named option
  const filename    = (typeof options === 'string') ? options : options.filename;
  assert(filename, 'Missing checks filename');

  // Pass timeout as named option, or use default
  const timeoutArg  = (typeof options !== 'string' && options.timeout) || DEFAULT_TIMEOUT;
  // If timeout argument is a string (e.g. "3d"), convert to milliseconds
  const timeout     = (typeof timeoutArg === 'string') ? ms(timeoutArg) : +timeoutArg;

  const onFailed    = options.onFailed || function() {};


  // Read all checks form the file and returns a checking function
  const runChecks = readChecks(filename, timeout);

  // Load Handlebars template for rendering results
  const template  = File.readFileSync(Path.join(__dirname, '/index.hbs'), 'utf-8');
  const render    = handlebars.compile(template);

  // Return the Express middleware
  return function(req, res) {

    const requestID = req.headers['x-request-id'];

    // We use local address/port to health check this server, e.g. the checks
    // may say //www.example.com/ but in development we connect to
    // 127.0.0.1:5000
    const protocol  = req.socket.encrypted ? 'https' : 'http';
    const hostname  = req.socket.localAddress;
    const port      = req.socket.localPort;

    // Run all checks
    debug('Running against %s://%s:%d with request-ID %s', protocol, hostname, port, requestID);
    runChecks(protocol, hostname, port, requestID)
      .then(function(outcomes) {
        debug('%d passed and %d failed', outcomes.passed.length, outcomes.failed.length);

        // Respond with 200 only if all checks passed
        // Respond with 500 if any check fail
        // Respond with 404 if there are no checks to run
        const statusCode  =
          outcomes.failed.length ? 500 :
          outcomes.passed.length ? 200 : 404;
        // Render template
        const html        = render({
          passed: _.sortBy(outcomes.passed, 'url'),
          failed: _.sortBy(outcomes.failed, 'url')
        });
        res.writeHeader(statusCode);
        res.write(html);
        res.end();

        if (outcomes.failed.length)
          onFailed(outcomes.failed);
      });
  };

};
