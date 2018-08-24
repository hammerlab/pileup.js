#!/bin/bash

# Check that all .js files have an @flow comment.
noflow=$(git ls-files | egrep '^(src|test).*\.js$' | grep -v '/data-canvas.js' | xargs grep --files-without-match '@flow')
if [ -n "$noflow" ]; then
  echo 'These files are missing @flow annotations:'
  echo "$noflow"
  exit 1
fi

# Check that the versions in package.json and pileup.js match.
package_version=$(grep '"version": ' package.json | sed 's/.*: "//; s/".*//')
code_version=$(grep 'version: ' src/main/pileup.js | sed "s/.*: '//; s/'.*//")
if [[ $package_version != $code_version ]]; then
  echo "pileup.js version mismatch!"
  echo "        package.json: $package_version"
  echo "  src/main/pileup.js: $code_version"
  exit 1
fi

# Run the usual linter
./node_modules/.bin/eslint src/**/**/*.js
