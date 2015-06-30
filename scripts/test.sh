#!/bin/bash
# Starts the http-server and runs mocha-phantomjs-based tests

# Run http-server and save its PID
npm run http-server > /dev/null &
SERVER_PID=$!

# Start the tests
npm run mocha-phantomjs
TEST_STATUS=$?

# Kill the http server
pkill -TERM -P $SERVER_PID

# Exit with test status
exit $TEST_STATUS
