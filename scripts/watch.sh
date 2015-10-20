#!/bin/bash
# Watches untransformed files for changes that affect the distribution/test

# Clean background processes after quit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

npm run minid3  # TODO: remove

# Start watchers
watchify -v -t babelify src/test/*.js      --debug -o dist/tests.js &
watchify -v -t babelify src/main/pileup.js --debug -o dist/pileup.js --standalone pileup &

# Wait until background processes end
wait
