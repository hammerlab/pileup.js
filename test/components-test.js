/* @flow */

var chai = require('chai');
var expect = chai.expect;

var Q = require('q');
var _ = require('underscore');

var React = require('react/addons'),
    TwoBit = require('../src/TwoBit'),
    BigBed = require('../src/BigBed'),
    Root = require('../src/Root'),
    createTwoBitDataSource = require('../src/TwoBitDataSource'),
    createBigBedDataSource = require('../src/BigBedDataSource');


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
      def.resolve();
      window.clearTimeout(timeoutId);
    } else {
      checkTimeoutId = window.setTimeout(check, WAIT_FOR_POLL_INTERVAL_MS);
    }
  };
  checkTimeoutId = window.setTimeout(check, 0);

  return def.promise;
}


/**
 * Apply a CSS selector to a React tree. Returns an array of DOM nodes.
 */
function findInComponent(selector, component) {
  return _.toArray(component.getDOMNode().querySelectorAll(selector));
}


describe('Root component', function() {
  var genome = new TwoBit('/hg19.2bit');
  var dataSource = createTwoBitDataSource(genome);

  var ensembl = new BigBed('/ensGene.bb');
  var ensemblDataSource = createBigBedDataSource(ensembl);

  var testDiv = document.getElementById('testdiv');

  afterEach(function() {
    testDiv.innerHTML = '';  // avoid pollution between tests.
  });

  it('should render reference genome and genes', function(done) {
    this.timeout(5000);

    var div = document.createElement('div');
    div.setAttribute('style', 'width: 800px; height: 200px;');
    testDiv.appendChild(div);

    var root = React.render(<Root referenceSource={dataSource}
                                  geneSource={ensemblDataSource} />, div);

    var ready = (() => 
      div.querySelectorAll('.basepair').length > 0 &&
      div.querySelectorAll('.gene').length > 0
    );

    waitFor(ready, 5000)
      .then(() => {
        var basepairs = div.querySelectorAll('.basepair');
        expect(basepairs).to.have.length.at.least(10);
        var geneNames = div.querySelectorAll('.gene text');
        expect(geneNames.length).to.equal(1);
        expect(geneNames[0].textContent).to.equal('TP53');

        // Note: there are 11 exons, but two are split into coding/non-coding
        expect(div.querySelectorAll('.gene .exon').length).to.equal(13);
        done();
      })
      .done();
  });
});
