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
const Handlerbars = require('handlebars');
const ms          = require('ms');
const request     = require('request');
const URL         = require('url');


// Default timeout for checks; a slow server is a failed server.
const DEFAULT_TIMEOUT = '3s';


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
      debug('Added check', match[1], match[2]);
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
    .reduce(function(checks, check) {
      const url = check.url;
      checks[url] = checks[url] || [];
      if (check.expected)
        checks[url].push(check.expected);
      return checks;
    }, {});

  // Returns a check function that will use these checks / settings
  const context = {
    checks:   checks,
    timeout:  timeout
  };
  return checkFunction.bind(context);
}


// Represents a check outcome with the properties url, reason, etc.
function Outcome(url, expected, error, response, body) {
  this.url = url;
  if (error) {

    if (error.code === 'ETIMEDOUT') {
      this.reason   = 'timeout';
      this.timeout  = true;
    } else {
      this.reason   = 'error';
      this.error    = error;
    }

  } else {

    this.statusCode = response.statusCode;
    this.body       = body;
    if (response.statusCode < 200 || response.statusCode >= 400) {
      this.reason   = 'statusCode';
    } else {

      const allMatching = _.all(expected, function(text) {
        return body.indexOf(text) >= 0;
      });
      if (!allMatching)
        this.reason = 'body';

    }
  }
}

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
      return this.url;
    }
    default: {
      return this.url + ' => ' + this.reason;
    }
  }
};


// The check function will run all checks in parallel, and resolve to an object
// with the properties:
// passed  - A list of all check URLs that passed
// failed  - A list of all check URLs that failed
function checkFunction(baseURL, requestID) {
  const checks  = this.checks;
  const timeout = this.timeout;

  // Each check resolves into an outcome object
  const allChecks = _.map(checks, function(expected, checkURL) {
    return new Promise(function(resolve) {
      // Checks have relative URLs, resolve them to absolute URLs
      const absoluteURL = URL.resolve(baseURL, checkURL);
      const headers     = {};
      if (requestID)
        headers['X-Request-Id'] = requestID;
      const params  = {
        uri:      absoluteURL,
        headers:  headers,
        timeout:  timeout
      };
      request(params, function(error, response, body) {

        const outcome   = new Outcome(absoluteURL, expected, error, response, body);
        resolve(outcome);

        switch (outcome.reason) {
          case 'error': {
            debug('Server responded with error ' + error.message, absoluteURL);
            break;
          }
          case 'timeout': {
            debug('Server response timeout', absoluteURL);
            break;
          }
          case 'statusCode': {
            debug('Server responded with status code ' + response.statusCode, absoluteURL);
            break;
          }
          case 'body': {
            debug('Server response did not contain expected text', absoluteURL);
            break;
          }
        }
      });
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


// Call this function to configure and return the middleware.
module.exports = function healthchecks(options) {
  assert(options, 'Missing options');

  // Pass filename as first argument or named option
  const filename    = (typeof(options) === 'string') ? options : options.filename;
  assert(filename, 'Missing checks filename');

  // Pass timeout as named option, or use default
  const timeoutArg  = (typeof(options) !== 'string' && options.timeout) || DEFAULT_TIMEOUT;
  // If timeout argument is a string (e.g. "3d"), convert to milliseconds
  const timeout     = (typeof(timeoutArg) === 'string') ? ms(timeoutArg) : +timeoutArg;

  const onFailed    = options.onFailed || function() {};


  // Read all checks form the file and returns a checking function
  const runChecks = readChecks(filename, timeout);

  // Load Handlebars template for rendering results
  const template  = File.readFileSync(__dirname + '/index.hbs', 'utf-8');
  const render    = Handlerbars.compile(template);

  // Return the Express middleware
  return function(request, response) {
    debug('Health checks: running');

    // The base URL where this middleware is mounted on.  We do this
    // dynamically, so sending healthchecks request to HTTP vs HTTPS, or
    // different domain, may result in running different checks.
    const mounted = URL.format({
      protocol: request.protocol,
      host:     request.headers.host,
      port:     request.port
    });

    const requestID = request.headers['x-request-id'];

    // Run all checks
    runChecks(mounted, requestID)
      .then(function(outcomes) {
        debug('Health checks: ' + outcomes.passed.length + ' passed and ' + outcomes.failed.length + ' failed');

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
        response.status(statusCode).send(html).end();

        if (outcomes.failed.length)
          onFailed(outcomes.failed);
      });
  };

};
