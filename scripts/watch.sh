#!/bin/bash
# Watches untransformed files for changes that effect the distribution/test

# Clean background processes after quit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Start watchers
npm run jstransform-watch &
npm run watch-dist &
npm run watch-test &

# Wait until background processes end
wait
