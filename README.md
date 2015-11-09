# Healthchecks

Express middleware that runs health checks on your application.  Allows you to
manage a list of healthchecks as plain text files, keep them in source control
next to the application.  Provides a single endpoint you can access from a
mobile device, or from a monitoring service.


## What and Why?

A health check is a simple ping to a resource of your web application that
checks that your application is up and running, responding to network requests,
and behaving correctly.

It can be as simple as pinging the home page of a web site, checking that the
page includes the company's name in the title.

If you have a complex application, there are multiple things that can break
independently, and so you want a good health coverage by checking multiple
resources (see [What Should I Check?](#what-should-i-check)).

If your application has got one page that's accessing the database, and another
page that just storing requests in a queue, you want to check both[1].

Whether you're using a service like Pingdom or internal tool like Nagios, if
you store your checks there, funny thing is they never get updated when you roll
out new features.

You want checks to be part of the code base, in source control, right next to
the application code that's getting checked, where it can be versioned and code
reviewed.

And that's what this module does.  It lets you write your checks as a plain text
file that lives in the same repository as your application.

And it gives you a single endpoint that you can open in a browser, to see a list
of all passed or failed checks.  The same endpoint you can also use with a
monitoring service like Pingdom or Nagios.


## Checks File

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

All URLs are relative to the server on which they are deployed, but must consist
of at least an absolute pathname.  You can include the hostname and protocol if
you need to, for example, if your tests are mounted at `http://example.com` and
you want to test `static.example.com` and test the HTTPS admin page:

```
# Check a different hostname than example.com
//static.example.com/logo.png

# Check with a different protocol and hostname
https://admin.example.com           Admin Dashboard
```

The expected content is matched literally against the body of the HTTP response.
Only 2xx responses are considered successful (however, redirects are followed).


## Usage

Install:

```bash
npm install --save healthchecks
```

Include the checks file with your web server, then configure the middleware to
read the checks file, for example:

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

**Note** this endpoint is publicly accessible.  You can use another middleware
to add access control, or add this feature and send us a pull request.

You can initialize the middleware with the checks file name, or with an object
containing the following options:

`filename` -- The name of the checks file
`onFailed` -- Called with array of failed checks
`timeout`  -- Timeout slow responses
`strictSSL` -- Defaults to true, false allows use of self-signed certificates for development

You can specify the timeout in milliseconds or as a string, e.g. "3s" for 3
seconds.

Each failed check reported to `onFailed` is an object with the following
properties:

`url`         -- The absolute URL
`reason`      -- One of 'error', 'timeout', 'statusCode' or 'body'
`error`       -- Connection or timeout error
`timeout`     -- True if failed due to timeout
`statusCode`  -- HTTP status code (if no error)
`body`        -- Response body

For convenience, the value of the `reason` property is the name of one of the
other properties.  Also, when you call `toString()` you get a URL with the
reason, e.g. "http://example.com => statusCode".

For example:

```javascript
const options = {
  filename:   CHECKS_FILE,
  timeout:    '5s',    // 5 seconds, can also pass duration in milliseconds
  strictSSL:  (process.env.NODE_ENV === 'production') ? true : false,
  onFailed:   function(checks) {
    checks.forEach(function(check) {
      log('The following check failed:', check.url, 'reason:', check.reason);
      // ... or ...
      log('The following check failed: %s', check);
    });
  }
};
server.use('/_healthchecks', healthchecks(options);
```


## What Should I Check?

> Anything that can go wrong will go wrong.
>
> -- Murphy's law

If two parts of your application can fail independently, you want to check both.

If you have static and dynamic page, you want to check both.

If different pages use different database servers, you want to check them all.

If some page uses a caching servers, you want to check that as well.

If another page uses a 3rd party API, also check that.

If your page is composed of multiple modules that can fail independently (say
shopping cart and product list), you want to check each module.

If something can fail that's not an HTML page, you want to check that as well.

Stylesheets? Check.  Client-side scripts?  Checks.  Images?  Checks.

If they are pre-processed, you want to check what was generated.

If it's served by a 3rd party CDN, don't skip this check.

If your application dynamically generates links (to pages, CSS, JS), check those
as well.

You can have too many checks, but most likely your problem is you don't have
enough!


## License

[MIT License](LICENSE) Copyright (c) 2014 Broadly Inc

