// To run this example:
//
//   DEBUG=healthchecks node example/index.js
//
// And in separate terminal window:
//
//   open http://localhost:4004/_healthchecks

const express       = require('express');
const healthchecks  = require('..');


const server = express();
server.use('/_healthchecks', healthchecks(__dirname + '/checks'));

server.listen(4004, function() {
  console.log('Healthchecks example listening on port', 4004);
  console.log('');
  console.log('open http://localhost:4004/_healthchecks');
});
