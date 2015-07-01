[![Build Status](https://travis-ci.org/hammerlab/pileup.js.svg?branch=travis-flow)](https://travis-ci.org/hammerlab/pileup.js) [![Coverage Status](https://coveralls.io/repos/hammerlab/pileup.js/badge.svg?branch=master)](https://coveralls.io/r/hammerlab/pileup.js?branch=master) [![NPM version](http://img.shields.io/npm/v/pileup.svg)](https://www.npmjs.org/package/pileup)

# pileup.js
Interactive in-browser track viewer. [**Try a demo**][demo]!

![pileup.js screenshot](./pileup-screenshot.png)

## Usage

To use pileup.js in a project, install it via NPM:

    npm install --save pileup

And then source either `node_modules/pileup/dist/pileup.browser.min.js` or `pileup.browser.js`.

To create a pileup, use `pileup.create()`. You specify a container DOM element,
an initial range and a list of tracks:

```javascript
var pileup = require('pileup');
var div = document.getElementById('your-id');
var p = pileup.create(div, {
  range: {contig: 'chr17', start: 7512384, stop: 7512544},
  tracks: [
    {
      viz: pileup.viz.genome(),
      isReference: true,
      data: pileup.formats.twoBit({
        url: 'http://www.biodalliance.org/datasets/hg19.2bit'
      }),
      name: 'Reference'
    },
    {
      viz: pileup.viz.pileup(),
      data: pileup.formats.bam({
        url: '/test-data/synth3.normal.17.7500000-7515000.bam',
        indexUrl: '/test-data/synth3.normal.17.7500000-7515000.bam.bai'
      }),
      cssClass: 'normal',
      name: 'Alignments'
    }
    // ...
  ]
});
```

Each track has a name, a data source and a visualization. See
[`/examples/playground.js`](/examples/playground.js) for a complete set of
track types.

To style the track viewer, use CSS! pileup.js uses [flexbox][] for track
layout. You can view [this codepen][layout] for a simple demo of the skeleton.
For example, to allocate 1/3 of the space to a variant track and 2/3 to a
pileup track, you could use this CSS:

```css
.track.variants { flex: 1; }
.track.pileup   { flex: 2; }
```

To style multiple tracks of the same type, you can use the `cssClass` property.

## Development

## Basic Setup

    git clone https://github.com/hammerlab/pileup.js.git
    cd pileup.js
    npm install
    npm run prod

To play with the demo, start an [http-server][hs]:

    npm run http-server

Then open [http://localhost:8080/examples/playground-complete.html](http://localhost:8080/examples/playground-complete.html) in your browser of choice.

### BioJS

Alternatively you can use [BioJS sniper][sniper] for the demo:

    npm install -g sniper # installs sniper globally

Once installed, start sniper in the `pileup.js` folder:

    sniper # and keep it running

And browse to [http://localhost:9090/examples/playground](http://localhost:9090/examples/playground).

## Testing

Run the tests from the command line:

    npm run test

Run the tests in a real browser:

    npm run http-server
    open http://localhost:8080/src/test/runner.html

To continuously regenerate the combined JS, run:

    npm run watch

To typecheck the code, run

    npm run flow

For best results, use one of the flowtype editor integrations.

## License

pileup.js is [Apache v2](/LICENSE) licensed.

[sniper]: https://github.com/biojs/sniper
[hs]: https://github.com/nodeapps/http-server
[layout]: http://codepen.io/anon/pen/VLzbBe?editors=110
[flexbox]: https://developer.mozilla.org/en-US/docs/Web/Guide/CSS/Flexible_boxes
[demo]: http://www.hammerlab.org/pileup/
