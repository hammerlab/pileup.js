/* @flow */
'use strict';

var expect = require('chai').expect;

var Q = require('q');
var pileup = require('../src/pileup');


var WAIT_FOR_POLL_INTERVAL_MS = 100;
function waitFor(predFn, timeoutMs) {
  var def = Q.defer();

  var checkTimeoutId = null;

  var timeoutId = window.setTimeout(() => {
    if (checkTimeoutId) window.clearTimeout(checkTimeoutId);
    def.reject('Timed out');
  }, timeoutMs);

  var check = function() {
    if (def.promise.isRejected()) return;
    if (predFn()) {
      def.resolve(null);  // no arguments needed
      window.clearTimeout(timeoutId);
    } else {
      checkTimeoutId = window.setTimeout(check, WAIT_FOR_POLL_INTERVAL_MS);
    }
  };
  checkTimeoutId = window.setTimeout(check, 0);

  return def.promise;
}


describe('Root component', function() {
  var tracks = [
    {
      viz: 'genome',
      isReference: true,
      data: {
        url: '/test/data/test.2bit'
      }
    },
    {
      viz: 'variants',
      data: {
        url: '/test/data/snv.chr17.vcf'
      }
    },
    {
      viz: 'genes',
      data: {
        // This file contains just TP53, shifted so that it starts at the
        // beginning of chr17 (to match test.2bit). See test/data/README.md.
        url: '/test/data/tp53.shifted.bb'
      }
    },
    {
      viz: 'pileup',
      data: {
        url: '/test/data/index_test.bam',
        indexUrl: '/test/data/index_test.bam.bai'
      }
    }
  ];

  var testDiv = document.getElementById('testdiv');

  afterEach(function() {
    testDiv.innerHTML = '';  // avoid pollution between tests.
  });

  it('should render reference genome and genes', function() {
    this.timeout(5000);

    var div = document.createElement('div');
    div.setAttribute('style', 'width: 800px; height: 200px;');
    testDiv.appendChild(div);

    pileup.create(div, {
      range: {contig:"chr17", start: 100, stop: 150},
      tracks: tracks
    });

    var ready = (() => 
      div.querySelectorAll('.basepair').length > 0 &&
      div.querySelectorAll('.gene').length > 0
    );

    return waitFor(ready, 5000)
      .then(() => {
        var basepairs = div.querySelectorAll('.basepair');
        expect(basepairs).to.have.length.at.least(10);
        var geneNames = div.querySelectorAll('.gene text');
        expect(geneNames.length).to.equal(1);
        expect(geneNames[0].textContent).to.equal('TP53');

        // Note: there are 11 exons, but two are split into coding/non-coding
        expect(div.querySelectorAll('.gene .exon').length).to.equal(13);
      });
  });
});
