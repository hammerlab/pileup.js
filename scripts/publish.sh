#!/bin/bash
# Publish an updated version of pileup.js on NPM.

set +x
set -o errexit

# Ensure a clean dist directory
rm -rf dist

npm run build

# No need to distribute tests
rm dist/tests.js

# Once we have more confidence in it, this script should just run `npm publish`.
echo
echo "Now run npm publish"
