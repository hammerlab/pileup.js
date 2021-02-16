#!/bin/bash
# Build require-ale and minified assets for distribution.
set -o errexit
./scripts/make-mini-d3.sh # TODO: remove

# Transpile individual files. This is useful if another module,
# e.g. cycledash, wants to require('pileup').
# The dist/test files are required for code coverage
mkdir -p dist/test/{data,source,viz}
babel src --retain-lines --ignore src/lib --out-dir dist
cp -r src/lib dist/

# Create dist/tests
browserify \
  -v \
  -t [ babelify --ignore [src/lib] ] \
  --debug \
  -o dist/tests.js \
  $(find src/test -name '*.js')

# Create dist/pileup.js
browserify \
  -v \
  -t [ babelify --ignore [src/lib] ] \
  -g [ envify --NODE_ENV production ] \
  -g uglifyify \
  src/main/pileup.js \
  --debug \
  -o dist/pileup.js \
  --standalone pileup

# Create dist/pileup.js.map
cat dist/pileup.js | exorcist --base . dist/pileup.js.map > /dev/null

version=$(grep '"version": ' package.json | sed 's/.*: "//; s/".*//')
header="/*! pileup v$version | (c) 2015 HammerLab | Apache-2.0 licensed */"
sourcemap="content='dist/pileup.js.map',filename='dist/pileup.min.js.map',includeSources=true"

# Create dist/pileup.js.min{,.map}
uglifyjs --compress --mangle \
  --beautify "beautify=false,preamble='$header'" \
  --source-map $sourcemap \
  -o dist/pileup.min.js \
  dist/pileup.js
