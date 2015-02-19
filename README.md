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

Run the tests in a real browser:

    grunt browsertests
    open tests/runner.html

To iterate on code while running the type checker:

    grunt watchFlow
