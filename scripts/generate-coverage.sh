#!/bin/bash
# Generate code coverage data for posting to Coveralls.
# This requires dist/*.js to be in place.
# Output is coverage/lcov.info

set -o errexit
set -x

# Instrument the source code with Istanbul's __coverage__ variable.
rm -rf coverage/*  # Clear out everything to ensure a hermetic run.
istanbul instrument --output coverage/main dist/main
cp -r dist/test coverage/test  # test code needn't be covered

# Build a combined file for running the tests in-browser
browserify coverage/**/*.js -o coverage/tests.js

# Run http-server and save its PID for cleanup
http-server > /dev/null &
SERVER_PID=$!
function finish() {
  kill -TERM $SERVER_PID
}
trap finish EXIT

# Give the server a chance to start up
sleep 1

# Run the tests using mocha-phantomjs & mocha-phantomjs-istanbul
# This produces coverage/coverage.json
phantomjs \
  ./node_modules/mocha-phantomjs/lib/mocha-phantomjs.coffee \
  http://localhost:8080/src/test/coverage.html \
  spec '{"hooks": "mocha-phantomjs-istanbul", "coverageFile": "coverage/coverage.json"}'

# Convert the JSON coverage to LCOV for coveralls.
istanbul report --include coverage/*.json lcovonly

# Monkey patch in the untransformed source paths.
perl -i -pe 's,dist/main,src/main,' coverage/lcov.info
