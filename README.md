# Healthchecks

Express middleware to run a sequence of health checks, as specified in a check
file.

This module allows you to monitor a single endpoint on your server, that checks
multiple resource.  A single check is often not enough to monitor your
application, quite common for only some resources to go bad.  On the other hand,
multiple external checks (e.g. Pingdom) could lead to barrage of alerts when the
application is down.  They're also harder to manage and not checked into source
control.

This module allows you to declare all your health checks in one file, which you
check into source control as part of your application's code base.  You then
point the check server at a single resource, for a single alert.

You can also access that URL from any device and immediately see a list of
passed and failed checks.  Note that this page is publicly accessible.


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


## What Should I Check?

> Anything that can go wrong will go wrong.
>
> -- Murphy's law

If you have static and dynamic pages, you want to check one of each.

If different pages use different database servers (e.g. relational and content),
you want to check one of each.

If some pages use a caching servers, you want to check one of these.

If some pages use a 3rd party API, you want to check for one of these.

If pages are composed of multiple independent modules, e.g. the layout and body
are managed in different layers of the application, write one check for each.

In addition to pages, check stylesheets, client-side scripts, images and other
assets are served correctly.

If you pre-process any of these, check they exist and also contain some output.

Even if they're served from a 3rd party CDN, check them.

If your application dynamically creates links to CSS/JS, check those links
actually point to the right place.

You can have too many checks, but most likely you don't have enough!

