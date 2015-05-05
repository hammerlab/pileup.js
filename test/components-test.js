/* @flow */
'use strict';

var expect = require('chai').expect;

var Q = require('q');

var React = require('react/addons'),
    TwoBit = require('../src/TwoBit'),
    Bam = require('../src/bam'),
    BigBed = require('../src/BigBed'),
    VcfFile = require('../src/vcf'),
    Root = require('../src/Root'),
    RemoteFile = require('../src/RemoteFile'),
    TwoBitDataSource = require('../src/TwoBitDataSource'),
    BigBedDataSource = require('../src/BigBedDataSource'),
    BamDataSource = require('../src/BamDataSource'),
    VcfDataSource = require('../src/VcfDataSource');


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
  var genome = new TwoBit('/test/data/test.2bit');
  var dataSource = TwoBitDataSource.create(genome);

  // This file contains just the TP53 gene, shifted so that it starts at the
  // beginning of chr17 (to match test.2bit). See test/data/README.md.
  var ensembl = new BigBed('/test/data/tp53.shifted.bb');
  var ensemblDataSource = BigBedDataSource.create(ensembl);

  var bam = new Bam(new RemoteFile('/test/data/index_test.bam'),
                    new RemoteFile('/test/data/index_test.bam.bai'));
  var bamSource = BamDataSource.create(bam);

  var vcf = new VcfFile(new RemoteFile('/test/data/snv.chr17.vcf'));
  var vcfSource = VcfDataSource.create(vcf);

  var testDiv = document.getElementById('testdiv');

  afterEach(function() {
    testDiv.innerHTML = '';  // avoid pollution between tests.
  });

  it('should render reference genome and genes', function() {
    this.timeout(5000);

    var div = document.createElement('div');
    div.setAttribute('style', 'width: 800px; height: 200px;');
    testDiv.appendChild(div);

    // TODO: changing to {start:1, stop:50} makes the test fail.
    React.render(<Root referenceSource={dataSource}
                       geneSource={ensemblDataSource}
                       bamSource={bamSource}
                       variantSource={vcfSource}
                       initialRange={{contig:"chr17", start: 100, stop: 150}} />, div);

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
