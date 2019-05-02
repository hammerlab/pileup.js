#!/bin/bash
# Starts the http-server and runs mocha-chrome-based tests
# Note that you must run `npm run build` or `npm run watch` before running this.
set -o errexit

# Run http-server and save its PID
http-server -p 8081 > /dev/null &
SERVER_PID=$!
function finish() {
  kill -TERM $SERVER_PID
}
trap finish EXIT

# the following sleep step is not really necessary
# as http-server starts almost instantenously;
# but letting the server settle might help prevent
# possible racing conditions
sleep 1

# extract parameters passed to "npm test" method
grep_param=''
while [ $# -gt 0 ]; do
  case "$1" in
    --grep=*)
      grep_param="${1#*=}"
      ;;
    *)
      printf "Error: Invalid argument: $1\n"
      exit 1
  esac
  shift
done

# Start the tests
mocha-headless-chrome -f http://localhost:8081/src/test/runner.html?grep=$grep_param
