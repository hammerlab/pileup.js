# pileup.js
Interactive in-browser track viewer

## Quickstart

  git clone https://github.com/danvk/pileup.js.git
  cd pileup.js
  npm install
  grunt prod

Then open `playground.html` in your browser of choice.

## Development

Run the tests from the command line:

  grunt test

Run the tests in a browser:

  grunt browsertests
  open tests/runner.html

Iterate on the tests:

  watchify test/*-test.js -o build/tests.js

(and reload the `runner.html` page in your browser after making changes.)

To iterate on code while running the type checker:

  grunt watchFlow
