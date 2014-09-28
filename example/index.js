// To run this example:
//
//   DEBUG=healthcheck node example/index.js
//
// And in separate terminal window:
//
//   open http://localhost:4004/_healthchecks

const express     = require('express');
const healthcheck = require('..');


const server = express();
server.use('/_healthchecks', healthcheck({ filename: __dirname + '/checks' }));

server.listen(4004, function() {
  console.log('Healthcheck example listening on port', 4004);
  console.log('');
  console.log('open http://localhost:4004/_healthchecks');
});
