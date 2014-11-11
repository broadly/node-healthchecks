# Healthchecks

Express middleware to run a sequence of health checks, as specified in a check
file.

This module allows you to monitor a single endpoint on your server, that checks
multiple resource.  A single check is often not enough to monitor your
application (e.g. different pages that access different back-ends could fail
independently).  Multiple external checks can lead to barrage of alerts (e.g.
when the monitoring server has network issues).  They are also harder to manage
(not in source control).


## Usage

With this you create a single checks file, that you can check into source
control as part of your application, and run these checks from any route on your
server.

For example:

```javascript
const healthchecks = require('healthchecks');

// This file contains all the checks
const CHECKS_FILE = __dirname + '/checks';

// Mount the middleware at /_healthchecks
server.use('/_healthchecks', healthchecks(CHECKS_FILE));
```

Now point your monitoring at `http://example.com/_healthchecks`.

You can also open this page with your browser to see a list of passing and
failed tests.


## Checks

The checks file lists one or more resources to check, and the expected content
of each resource (which may be empty).

For example:

```
# Check a web page
/                       My Amazing App

# Check stylesheets and scripts
/stylesheets/index.css  .body
/scripts/index.js       "use strict"

# Check the image exist
/images/logo.png
```

All URLs are relative to the check endpoint, but must consist of at least an
absolute pathname.  You can include the hostname and protocol if you need to,
for example, if your tests are mounted at `http://example.com` and you want to
test `static.example.com` and the HTTPS admin page:

```
# Check a different hostname than example.com
//static.example.com/logo.png

# Check with a different protocol
https://admin.example.com           Admin Dashboard
```

The expected content is matched literally against the body of the HTTP response.
4xx and 5xx status codes cause the check to fail.  In fact, only 2xx responses
are considered successful.


## Options

You can initialize the middleware with the checks file name, or with an object
containing the following options:

`filename` -- The name of the checks file
`timeout`  -- Timeout slow responses

You can specify the timeout in milliseconds or as a string, e.g. "3s" for 3
seconds.

For example:

```javascript
const options = {
  filename: CHECKS_FILE,
  timeout:  '5s'     // 5 seconds, can also pass duration in milliseconds
};
server.use('/_healthchecks', healthchecks(options);
```

