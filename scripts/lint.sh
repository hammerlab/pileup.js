#!/bin/bash

which flow
flow --version
echo "/**@flow*/\nimport type * as Point from './point'; function f(p: Point) { return new Point(); }" | flow check-contents

noflow=$(git ls-files | egrep '^(src|test).*\.js$' | xargs grep --files-without-match '@flow')
if [ -n "$noflow" ]; then
  echo 'These files are missing @flow annotations:'
  echo "$noflow"
  exit 1
fi

./node_modules/.bin/jsxhint --es6module --harmony 'src/**/*.js' 'test/**/*.js'
