# pileup.js
Interactive in-browser track viewer

## Quickstart

  git clone https://github.com/danvk/pileup.js.git
  cd pileup.js
  npm install
  grunt prod

Then open `playground.html` in your browser of choice.

## Development

Run the tests:

  browserify test/*-test.js -o build/tests.js
  open tests/runner.html

Iterate on the tests:

  watchify test/*-test.js -o build/tests.js
