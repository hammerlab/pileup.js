#!/bin/bash
# Generate code coverage data for posting to Coveralls.
# This requires dist/*.js to be in place.
# Output is coverage/lcov.info

set -o errexit
set -x

# Instrument the source code with Istanbul's __coverage__ variable.
# We clear out everything to ensure a hermetic run.
rm -rf coverage/*
istanbul instrument --output coverage/main dist/main
istanbul instrument --output coverage/test dist/test

# Build a combined file for running the tests in-browser
browserify coverage/**/*.js -o coverage/tests.js

# Run http-server and save its PID for cleanup
npm run http-server > /dev/null &
SERVER_PID=$!
function finish() {
  pkill -TERM -P $SERVER_PID
}
trap finish EXIT

# Run the tests using mocha-phantomjs & mocha-phantomjs-istanbul
# This produces coverage/coverage.json
phantomjs \
  ./node_modules/mocha-phantomjs/lib/mocha-phantomjs.coffee \
  http://localhost:8080/src/test/coverage.html \
  spec '{"hooks": "mocha-phantomjs-istanbul", "coverageFile": "coverage/coverage.json"}'

# Convert the JSON coverage to LCOV for coveralls.
istanbul report --include coverage/*.json lcovonly
