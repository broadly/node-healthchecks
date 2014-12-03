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
    });

  // Returns a check function that will use these checks / settings
  const context = {
    checks:   checks,
    timeout:  timeout
  };
  return checkFunction.bind(context);
}


// The check function will run all checks in parallel, and resolve to an object
// with the properties:
// passed  - A list of all check URLs that passed
// failed  - A list of all check URLs that failed
function checkFunction(baseURL, requestID) {
  const checks  = this.checks;
  const timeout = this.timeout;

  // Checks have relative URLs, resolve them to absolute URLs
  // We use this array twice, when mapping to promises that check the URL
  // (allChecks), and when reducing check results to aggregate (passedAndFailed)
  const urls    = checks.map(function(check) {
    return URL.resolve(baseURL, check.url);
  });

  // Each check resolves into a boolean: success or failure
  const allChecks = checks.map(function(check, index) {
    return new Promise(function(resolve) {
      const url     = urls[index];
      const headers   = {};
      if (requestID)
        headers['X-Request-Id'] = requestID;
      const params  = {
        uri:      url,
        headers:  headers,
        timeout:  timeout
      };
      request(params, function(error, response, body) {
        if (error) {
          debug('Server responded with error ' + error.message, url);
          resolve(false);
        } else if (response.statusCode < 200 || response.statusCode >= 400) {
          debug('Server responded with status code ' + response.statusCode, url);
          resolve(false);
        } else if (body.indexOf(check.expected) < 0) {
          debug('Server response did not contain expected text', url);
          resolve(false);
        } else
          resolve(true);
      });
    });
  });

  // Run all checks in parallel
  const allResults = Promise.all(allChecks);

  // Reduce into an object with the passed and failed lists of URLs
  const passedAndFailed = allResults.then(function(results) {
    // Partition the results into an array of passed and failed URLs
    const initial = {
      passed: [],
      failed: []
    };
    return results.reduce(function(totals, passed, index) {
      const url = urls[index];
      if (passed)
        totals.passed.push(url);
      else
        totals.failed.push(url);
      return totals;
    }, initial);
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
  const timeoutArg  = (typeof(options) === 'string' && options.timeout) || DEFAULT_TIMEOUT;
  // If timeout argument is a string (e.g. "3d"), convert to milliseconds
  const timeout     = (typeof(timeoutArg) === 'string') ? ms(timeoutArg) : +timeoutArg;

  const onfailed    = options.onfailed || function() {};


  // Read all checks form the file and returns a checking function
  const runChecks = readChecks(filename, timeout);

  // Load Handlebars template for rendering results
  const template  = File.readFileSync(__dirname + '/results.hbs', 'utf-8');
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
      .then(function(results) {
        debug('Health checks: ' + results.passed.length + ' passed and ' + results.failed.length + ' failed');

        // Respond with 200 only if all checks passed
        // Respond with 500 if any check fail
        // Respond with 404 if there are no checks to run
        const statusCode  =
          results.failed.length ?  500 :
          (results.passed.length ? 200 : 404);
        // Render template
        const html        = render(results);
        response.status(statusCode).send(html);

        if (results.failed.length)
          onfailed(results.failed);
      });
  };

};
