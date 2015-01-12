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

