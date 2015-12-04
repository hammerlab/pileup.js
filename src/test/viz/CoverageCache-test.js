/**
 * @flow
 */
'use strict';

import type {Alignment, CigarOp, MateProperties, Strand} from '../../main/Alignment';

import {expect} from 'chai';
import _ from 'underscore';

import CoverageCache from '../../main/viz/CoverageCache';
import ContigInterval from '../../main/ContigInterval';
import {makeRead, makeReadPair, fakeSource} from '../FakeAlignment';

describe('CoverageCache', function() {
  function ci(chr: string, start: number, end:number) {
    return new ContigInterval(chr, start, end);
  }

  function makeCache(args) {
    var cache = new CoverageCache(fakeSource);
    _.flatten(args).forEach(read => cache.addAlignment(read));
    return cache;
  }

  it('should collect coverage', function() {
    var cache = makeCache([
      makeReadPair(ci('chr1', 100, 200), ci('chr1', 800, 900)),
      makeReadPair(ci('chr1', 300, 400), ci('chr1', 750, 850)),
      makeReadPair(ci('chr2', 100, 200), ci('chr2', 300, 400))
    ]);

    var bins = cache.binsForRef('chr1');
    expect(bins[100]).to.deep.equal({count: 1});
    expect(bins[799]).to.deep.equal({count: 1});
    expect(bins[800]).to.deep.equal({count: 2});
    expect(bins[850]).to.deep.equal({count: 2});
    expect(bins[851]).to.deep.equal({count: 1});
    expect(cache.maxCoverageForRef('chr1')).to.equal(2);
  });

  it('should collect mismatches', function() {
    var letter = '.';  // pretend the reference is this letter, repeated
    var refSource = _.extend({}, fakeSource, {
      getRangeAsString: function(range) {
        return letter.repeat(range.stop - range.start + 1);
      }
    });

    var makeSeqRead = (ci, seq) => {
      expect(seq.length).to.equal(ci.length());
      var read = makeRead(ci, '+');
      _.extend(read, {
        getSequence() { return seq; },
        cigarOps: [{op: 'M', length: seq.length}]
      });
      return read;
    };

    var cache = new CoverageCache(refSource);
    // reference starts unknown.                     01234567890
    cache.addAlignment(makeSeqRead(ci('1', 10, 15), 'AAAAAA'));  // = ref
    cache.addAlignment(makeSeqRead(ci('1', 11, 16),  'AAAATA'));  // mismatch
    cache.addAlignment(makeSeqRead(ci('1', 12, 17),   'CAAAAC'));  // mismatch
    cache.addAlignment(makeSeqRead(ci('1', 13, 18),    'AAAAAA'));  // = ref
    cache.addAlignment(makeSeqRead(ci('1', 14, 19),     'AGAAAA'));
    cache.addAlignment(makeSeqRead(ci('1', 15, 20),      'AACAAA'));

    letter = 'A';  // now the reference is known.
    cache.updateMismatches(ci('chr1', 1, 20));
    var bins = cache.binsForRef('chr1');
    expect(bins[10]).to.deep.equal({count: 1});
    expect(bins[11]).to.deep.equal({count: 2});
    expect(bins[12]).to.deep.equal({count: 3, ref: 'A', mismatches: {C: 1}});
    expect(bins[13]).to.deep.equal({count: 4});
    expect(bins[14]).to.deep.equal({count: 5});
    expect(bins[15]).to.deep.equal({count: 6, ref: 'A', mismatches: {T: 1, G: 1}});
    expect(bins[16]).to.deep.equal({count: 5});
    expect(bins[17]).to.deep.equal({count: 4, ref: 'A', mismatches: {C: 2}});
    expect(bins[18]).to.deep.equal({count: 3});
    expect(bins[19]).to.deep.equal({count: 2});
    expect(bins[20]).to.deep.equal({count: 1});
    expect(cache.maxCoverageForRef('chr1')).to.equal(6);

    // Now change the reference
    letter = 'C';
    cache.updateMismatches(ci('chr1', 1, 20));
    bins = cache.binsForRef('chr1');
    expect(bins[10]).to.deep.equal({count: 1, ref: 'C', mismatches: {A: 1}});
    expect(bins[12]).to.deep.equal({count: 3, ref: 'C', mismatches: {A: 2}});
    expect(bins[15]).to.deep.equal({count: 6, ref: 'C', mismatches: {A: 4, T: 1, G: 1}});
    expect(bins[17]).to.deep.equal({count: 4, ref: 'C', mismatches: {A: 2}});
    expect(cache.maxCoverageForRef('chr1')).to.equal(6);
  });
});
