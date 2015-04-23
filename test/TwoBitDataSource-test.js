/* @flow */
'use strict';

var expect = require('chai').expect;

var TwoBit = require('../src/TwoBit');
var createTwoBitDataSource = require('../src/TwoBitDataSource');

describe('TwoBitDataSource', function() {
  function getTestSource() {
    // See description of this file in TwoBit-test.js
    var tb = new TwoBit('/test/data/test.2bit');
    return createTwoBitDataSource(tb);
  }

  it('should fetch contigs', function(done) {
    var source = getTestSource();
    source.on('contigs', contigs => {
      expect(contigs).to.deep.equal(['chr1', 'chr17', 'chr22']);
      done();
    });
    source.needContigs();
  });

  it('should fetch base pairs', function(done) {
    var source = getTestSource();
    var range = {contig: 'chr22', start: 1, stop: 4};

    // Before data has been fetched, all base pairs are null.
    expect(source.getRange(range)).to.deep.equal({
      'chr22:1': null,
      'chr22:2': null,
      'chr22:3': null,
      'chr22:4': null
    });

    source.on('newdata', () => {
      expect(source.getRange(range)).to.deep.equal({
        'chr22:1': 'N',
        'chr22:2': 'T',
        'chr22:3': 'C',
        'chr22:4': 'A'
      });
      done();
    });
    source.rangeChanged(range);
  });

  it('should fetch nearby base pairs', function(done) {
    var tb = new TwoBit('/test/data/test.2bit'),
        source = createTwoBitDataSource(tb);

    source.on('newdata', () => {
      expect(source.getRange({contig: 'chr22', start: 1, stop: 15}))
          .to.deep.equal({
            'chr22:1':  'N',
            'chr22:2':  'T',
            'chr22:3':  'C',
            'chr22:4':  'A',
            'chr22:5':  'C',  // start of actual request
            'chr22:6':  'A',
            'chr22:7':  'G',
            'chr22:8':  'A',
            'chr22:9':  'T',
            'chr22:10': 'C',  // end of actual requuest
            'chr22:11': 'A',
            'chr22:12': 'C',
            'chr22:13': 'C',
            'chr22:14': 'A',
            'chr22:15': 'T',
          });
      done();
    });
    source.rangeChanged({contig: 'chr22', start: 5, stop: 10});
  });
});
