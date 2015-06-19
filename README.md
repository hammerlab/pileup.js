[![Build Status](https://travis-ci.org/hammerlab/pileup.js.svg?branch=travis-flow)](https://travis-ci.org/hammerlab/pileup.js) [![Coverage Status](https://coveralls.io/repos/hammerlab/pileup.js/badge.svg?branch=master)](https://coveralls.io/r/hammerlab/pileup.js?branch=master) [![NPM version](http://img.shields.io/npm/v/pileup.svg)](https://www.npmjs.org/package/pileup)

# pileup.js
Interactive in-browser track viewer

## Quickstart

    git clone https://github.com/hammerlab/pileup.js.git
    cd pileup.js
    npm install
    npm install -g grunt-cli
    grunt prod

To play with the demo, you'll need to install the node.js [http-server][hs]:

    npm install -g http-server
    http-server

Then open [http://localhost:8080/examples/playground-complete.html](http://localhost:8080/examples/playground-complete.html) in your browser of choice.

Alternatively you can use [BioJS sniper][sniper] for the demo:
    
    npm install -g sniper # installs sniper globally

Once installed, start sniper in the `pileup.js` folder:

    sniper # and keep it running

And browse to [http://localhost:9090/examples/playground](http://localhost:9090/examples/playground).

![pileup.js screenshot](./pileup-screenshot.png)

## Development

Run the tests from the command line:

    grunt test

Run the tests in a real browser:

    grunt browserify:watchTest
    open tests/runner.html

To continuously regenerate the combined JS, run:

    grunt browserify:watchDist

To typecheck the code, run

    flow status .

For best results, use one of the flowtype editor integrations.

[sniper]: https://github.com/biojs/sniper
[hs]: https://github.com/nodeapps/http-server
