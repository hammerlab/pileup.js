/* @flow */
'use strict';

import {expect} from 'chai';

import SequenceStore from '../main/SequenceStore';
import ContigInterval from '../main/ContigInterval';

describe('SequenceStore', function() {
  var ci = (contig, start, stop) => new ContigInterval(contig, start, stop);
  it('should store sequences', function() {
    var store = new SequenceStore();
    store.setRange(ci('chr1', 100, 109), 'ABCDEFGHIJ');
    expect(store.getAsString(ci('chr1', 100, 109))).to.equal('ABCDEFGHIJ');
  });

  it('should ignore chr-prefixes', function() {
    var store = new SequenceStore();
    store.setRange(ci('chr1', 100, 104), 'ABCDE');
    expect(store.getAsString(ci('1', 100, 104))).to.equal('ABCDE');

    store.setRange(ci('2', 100, 103), 'WXYZ');
    expect(store.getAsString(ci('chr2', 100, 103))).to.equal('WXYZ');
  });

  it('should store and retrieve across chunk boundaries', function() {
    var store = new SequenceStore();
    //                                  5678901234
    store.setRange(ci('X', 995, 1004), 'ABCDEFGHIJ');
    expect(store.getAsString(ci('X', 995, 1004))).to.equal('ABCDEFGHIJ');
  });

  it('should add .s for unknown regions', function() {
    var store = new SequenceStore();
    expect(store.getAsString(ci('chr1', 9, 15))).to.equal('.......');
    store.setRange(ci('chr1', 10, 14), 'ABCDE');
    expect(store.getAsString(ci('chr1', 9, 15))).to.equal('.ABCDE.');
  });

  it('should clobber previously-stored values', function() {
    var store = new SequenceStore();
    //                                  012345
    store.setRange(ci('chr1', 10, 14), 'ABCDE');
    store.setRange(ci('1', 13, 15),       'XYZ');
    expect(store.getAsString(ci('chr1', 9, 16))).to.equal('.ABCXYZ.');
  });

  it('should clobber across a boundary', function() {
    var store = new SequenceStore();
    //                                     7890123
    store.setRange(ci('chr1', 997, 1001), 'ABCDE');
    store.setRange(ci('1',    999, 1002),   'XYZW');
    expect(store.getAsString(ci('chr1', 996, 1003))).to.equal('.ABXYZW.');
  });

  it('should store on a boundary', function() {
    var store = new SequenceStore();
    store.setRange(ci('chr17', 1000, 1004), 'ABCDE');
    expect(store.getAsString(ci('chr17', 1000, 1004))).to.equal('ABCDE');
  });

  it('should store at a large position', function() {
    var store = new SequenceStore();
    store.setRange(ci('chr17', 123456789, 123456793), 'ABCDE');
    expect(store.getAsString(ci('chr17', 123456788, 123456794)))
        .to.equal('.ABCDE.');
  });

  it('should write across three chunks', function() {
    var store = new SequenceStore();
    store.setRange(ci('X', 500, 2499), 'ABCDE' + 'N'.repeat(1990) + 'FGHIJ');
    expect(store.getAsString(ci('X', 499, 505))).to.equal('.ABCDEN');
    expect(store.getAsString(ci('X', 2494, 2500))).to.equal('NFGHIJ.');
    expect(store.getAsString(ci('X', 499, 2500))).to.have.length(2002);
  });

  it('should return objects', function() {
    var store = new SequenceStore();
    store.setRange(ci('X', 10, 12), 'ABC');
    expect(store.getAsObjects(ci('X', 9, 12))).to.deep.equal({
      'X:9': null,
      'X:10': 'A',
      'X:11': 'B',
      'X:12': 'C'
    });
  });
});
