// Exports an Express middleware factory.
//
// Example:
//
//   const healthcheck = require('healthcheck');
//   const CHECKS_FILE = './checks';
//
//   server.use('/_healthchecks', healthcheck({ filename: CHECKS_FILE }));

const assert      = require('assert');
const Promise     = require('bluebird');
const debug       = require('debug')('healthcheck');
const File        = require('fs');
const Handlerbars = require('handlebars');
const ms          = require('ms');
const request     = require('request');
const URL         = require('url');


// Default timeout for checks; a slow server is a failed server.
const DEFAULT_TIMEOUT = ms('3s');


// Read the checks file and returns a check function (see checkFunction).
function readChecks(options) {
  const checks = File.readFileSync(options.filename, 'utf-8')
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
    timeout:  options.timeout || DEFAULT_TIMEOUT
  };
  return checkFunction.bind(context);
}


// The check function will run all checks in parallel, and resolve to an object
// with the properties:
// passed  - A list of all check URLs that passed
// failed  - A list of all check URLs that failed
function checkFunction(baseURL) {
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
      const url = urls[index];
      request({ uri: url, timeout: timeout }, function(error, response, body) {
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
module.exports = function healthcheck(options) {
  assert(options, 'Missing options');
  assert(options.filename, 'Missing checks filename');

  // Read all checks form the file and returns a checking function
  const runChecks = readChecks(options);

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

    // Run all checks
    runChecks(mounted)
      .then(function(results) {
        debug('Health checks: ' + results.passed.length + ' passed and ' + results.failed.length + ' failed');

        // Respond with 200 only if all checks passed
        const statusCode  = (results.failed && results.failed.length) ? 500 : 200;
        // Render template
        const html        = render(results);
        response.status(statusCode).send(html);
      });
  };

};
