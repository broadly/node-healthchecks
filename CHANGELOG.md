## Version 1.7.3  2016-06-21

CHANGED code cleanups and linting


## Version 1.7.2  2015-12-15

ADDED checks for HTTPS URLs now set `X-Forwarded-Proto`


## Version 1.7.1  2015-12-09

FIXED erroneous package pushed to npm


## Version 1.7.0  2015-12-09

FIXED always run checks against `localAddress` and `localPort`

FIXED checking subdomains works again

CHANGED dropped short-lived support for SSL

CHANGED follow up to 10 redirects


## Version 1.6.1  2015-11-09

FIXED follow redirects when performing checks

ADDED skip SSL certificate validation via `strictSSL` option


## Version 1.5.0  2015-05-16

CHANGED show response time in high resolution (including nanoseconds)


## Version 1.4.4  2015-04-16

CHANGED show response time in seconds, 2 decimal places


## Version 1.4.3  2015-03-27

FIXED debug logging check requests


## Version 1.4.2  2015-03-27

FIXED connection.encrypted is now socket.encrypted (0.12/io.js)


## Version 1.4.1  2015-03-27

FIXED maintain the same connection protocol (in addition to IP/port)


## Version 1.4.0  2015-03-24

CHANGED run checks against localAddress/localPort


## Version 1.3.1  2015-03-23

ADDED send user-agent header, some servers require this


## Version 1.3.0  2015-03-23

CHANGED module can be used as Node request handler, does not need Express


## Version 1.2.5  2015-02-11

CHANGED better styling for elapsed time


## Version 1.2.4  2015-02-11

ADDED show request elapsed time


## Version 1.2.3  2015-01-19

CHANGED outcome.toString() no shows error message or status code


## Version 1.2.2  2015-01-12

FIXED verify result page shows consolidated results


## Version 1.2.1  2015-01-12

CHANGED consolidate multiple checks for the same URL

FIXED did not accept timeout option


## Version 1.2.0  2015-01-11

CHANGED options `onfailed` replaced with `onFailed` which accepts an array of
check results (not just URLs).

Each failed check reported to `onFailed` is an object with the following
properties:

`url`         -- The absolute URL
`reason`      -- One of 'error', 'timeout', 'statusCode' or 'body'
`error`       -- Connection or timeout error
`timeout`     -- True if failed due to timeout
`statusCode`  -- HTTP status code (if no error)
`body`        -- Response body


## Version 1.1.1  2014-12-08

CHANGED only show each URL once, and sort alphabetically


## Version 1.1.0  2014-12-03

ADDED onfailed option: called with list of failed checks

ADDED If the client sends an X-Request-Id header when making a healthcheck
request, that header is sent to all checked resources

