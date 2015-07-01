#!/bin/bash
# Publish an updated version of pileup.js on NPM.

set +x
set -o errexit

# Ensure a clean dist directory
rm -rf dist

npm run jstransform
npm run browserify
npm run uglify

# jstransform creates this, but we don't want to distribute it.
rm -rf dist/.module-cache

# No need to distribute tests
rm -rf dist/test

# Once we have more confidence in it, this script should just run `npm publish`.
echo
echo "Now run npm publish"
