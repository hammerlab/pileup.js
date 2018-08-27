/* @flow */
'use strict';

import {expect} from 'chai';
import Q from 'q';

import TwoBit from '../../main/data/TwoBit';
import TwoBitDataSource from '../../main/sources/TwoBitDataSource';
import RemoteFile from '../../main/RemoteFile';

describe('TwoBitDataSource', function() {
  function getTestSource () {
    // See description of this file in TwoBit-test.js
    var tb = new TwoBit(new RemoteFile('/test-data/test.2bit'));
    return TwoBitDataSource.createFromTwoBitFile(tb);
  }

  var origBasePairsToFetch;
  beforeEach(function() {
    origBasePairsToFetch = TwoBitDataSource.testBasePairsToFetch();
  });
  afterEach(function() {
    TwoBitDataSource.testBasePairsToFetch(origBasePairsToFetch);
  });

  it('should fetch contigs', function(done) {
    var source = getTestSource();
    source.on('contigs', contigs => {
      expect(contigs).to.deep.equal(['chr1', 'chr17', 'chr22']);
      done();
    });
  });

  /**
   * Test case that visualize situation when we set range very big
   * (in millions) and afterwards we set the range to small subrange
   * of the huge range. The huge range shouldn't be fetched from
   * 2bit file. But due to //github.com/hammerlab/pileup.js/issues/416
   * every small request from the big range wasn't handled properly
   * afterwardfs.
   *
   */
  it('should fetch base pairs (bug 416)', function(done) {
    var source = getTestSource();
    // this range shouldn't be fetched because is huge
    var hugeRange = {contig: 'chr22', start: 0, stop: 114529884};

    // small range that due to bug wasn't properly handled
    var smallSubRange = {contig: 'chr22', start: 0, stop: 3};
    source.on('newdata', () => {
      // should be called only once when short chunk is requested
      expect(source.getRange(smallSubRange)).to.deep.equal({
        'chr22:0': 'N',
        'chr22:1': 'T',
        'chr22:2': 'C',
        'chr22:3': 'A'
      });
      expect(source.getRangeAsString(smallSubRange)).to.equal('NTCA');
      done();
    });

    // try to fetch huge chunk of data (should be skipped)
    source.rangeChanged(hugeRange);

    // and now try to fetch small chunk (should be fetched and proper newdata event should be dispatched)
    source.rangeChanged(smallSubRange);
  });

  it('should fetch base pairs', function(done) {
    var source = getTestSource();
    var range = {contig: 'chr22', start: 0, stop: 3};

    // Before data has been fetched, all base pairs are null.
    expect(source.getRange(range)).to.deep.equal({
      'chr22:0': null,
      'chr22:1': null,
      'chr22:2': null,
      'chr22:3': null
    });
    expect(source.getRangeAsString(range)).to.equal('....');

    source.on('newdata', () => {
      expect(source.getRange(range)).to.deep.equal({
        'chr22:0': 'N',
        'chr22:1': 'T',
        'chr22:2': 'C',
        'chr22:3': 'A'
      });
      expect(source.getRangeAsString(range)).to.equal('NTCA');
      done();
    });
    source.rangeChanged(range);
  });

  it('should fetch nearby base pairs', function(done) {
    var source = getTestSource();

    source.on('newdata', () => {
      expect(source.getRange({contig: 'chr22', start: 0, stop: 14}))
        .to.deep.equal({
          'chr22:0': 'N',
          'chr22:1': 'T',
          'chr22:2': 'C',
          'chr22:3': 'A',
          'chr22:4': 'C', // start of actual request
          'chr22:5': 'A',
          'chr22:6': 'G',
          'chr22:7': 'A',
          'chr22:8': 'T',
          'chr22:9': 'C', // end of actual requuest
          'chr22:10': 'A',
          'chr22:11': 'C',
          'chr22:12': 'C',
          'chr22:13': 'A',
          'chr22:14': 'T'
        });
      done();
    });
    source.rangeChanged({contig: 'chr22', start: 4, stop: 9});
  });

  it('should not fetch data twice', function(done) {
    var file = new RemoteFile('/test-data/test.2bit');

    var tb = new TwoBit(file);

    var source = TwoBitDataSource.createFromTwoBitFile(tb);

    // pre-load headers & the data.
    tb.getFeaturesInRange('chr22', 5, 10).then(function() {
      var newDataCount = 0;
      source.on('newdata', function() {
        newDataCount++;
      });
      source.once('newdata', function() {
        expect(newDataCount).to.equal(1);
        // do the same request again.
        source.rangeChanged({contig: 'chr22', start: 5, stop: 10});

        Q.delay(100 /* ms */).then(function() {
          expect(newDataCount).to.equal(1); // no new requests
          done();
        }).done();
      });
      source.rangeChanged({contig: 'chr22', start: 5, stop: 10});
    }).done();
  });

  it('should add chr', function(done) {
    var source = getTestSource();
    var range = {contig: '22', start: 0, stop: 3};

    source.on('newdata', () => {
      expect(source.getRange(range)).to.deep.equal({
        '22:0': 'N',
        '22:1': 'T',
        '22:2': 'C',
        '22:3': 'A'
      });
      expect(source.getRangeAsString(range)).to.equal('NTCA');
      done();
    });
    source.rangeChanged(range);
  });

  it('should allow a mix of chr and non-chr', function(done) {
    var source = getTestSource();
    var chrRange = {contig: 'chr22', start: 0, stop: 3};

    var range = {contig: '22', start: 0, stop: 3};

    source.on('newdata', () => {
      expect(source.getRange(range)).to.deep.equal({
        '22:0': 'N',
        '22:1': 'T',
        '22:2': 'C',
        '22:3': 'A'
      });
      expect(source.getRangeAsString(range)).to.equal('NTCA');
      done();
    });
    source.rangeChanged(chrRange);
  });

  it('should only report newly-fetched ranges', function(done) {
    TwoBitDataSource.testBasePairsToFetch(10);
    var initRange = {contig: 'chr22', start: 5, stop: 8};

    var secondRange = {contig: 'chr22', start: 8, stop: 15};
    var source = getTestSource();
    source.once('newdata', newRange => {
      expect(newRange.toString()).to.equal('chr22:0-10'); // expanded range

      source.once('newdata', newRange => {
        // This expanded range excludes previously-fetched data.
        expect(newRange.toString()).to.equal('chr22:11-20');
        done();
      });
      source.rangeChanged(secondRange);
    });
    source.rangeChanged(initRange);
  });
});
