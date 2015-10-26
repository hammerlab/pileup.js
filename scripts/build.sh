#!/bin/bash
# Build require-ale and minified assets for distribution.
set -o errexit
./scripts/make-mini-d3.sh # TODO: remove

# Transpile individual files. This is useful if another module,
# e.g. cycledash, wants to require('pileup').
# The dist/test files are required for code coverage
babel src --retain-lines --ignore src/lib --out-dir dist
cp -r src/lib dist/

# Create dist/tests
browserify \
  -v \
  -t [ babelify --ignore src/lib ] \
  --debug \
  -o dist/tests.js \
  src/test/*.js

# Create dist/pileup.js
browserify \
  -v \
  -t [ babelify --ignore src/lib ] \
  -g [ envify --NODE_ENV production ] \
  -g uglifyify \
  src/main/pileup.js \
  --debug \
  -o dist/pileup.js \
  --standalone pileup

# Create dist/pileup.js.map
cat dist/pileup.js | exorcist --base . dist/pileup.js.map > /dev/null

# Create dist/pileup.js.min{,.map}
uglifyjs --compress --mangle \
  --in-source-map dist/pileup.js.map \
  --source-map-include-sources \
  --source-map dist/pileup.min.js.map \
  -o dist/pileup.min.js \
  dist/pileup.js
