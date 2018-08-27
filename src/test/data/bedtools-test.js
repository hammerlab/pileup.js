/* @flow */
'use strict';

import {expect} from 'chai';

import bedtools from '../../main/data/bedtools';
import Interval from '../../main/Interval';

describe('bedtools', function() {
  describe('splitCodingExons', function() {
    var splitCodingExons = bedtools.splitCodingExons;
    var CodingInterval = bedtools.CodingInterval;

    it('should split one exon', function(done) {
      var exon = new Interval(10, 20);

      expect(splitCodingExons([exon], new Interval(13, 17))).to.deep.equal([
        new CodingInterval(10, 12, false),
        new CodingInterval(13, 17, true),
        new CodingInterval(18, 20, false)
      ]);

      expect(splitCodingExons([exon], new Interval(5, 15))).to.deep.equal([
        new CodingInterval(10, 15, true),
        new CodingInterval(16, 20, false)
      ]);

      expect(splitCodingExons([exon], new Interval(15, 25))).to.deep.equal([
        new CodingInterval(10, 14, false),
        new CodingInterval(15, 20, true)
      ]);

      expect(splitCodingExons([exon], new Interval(10, 15))).to.deep.equal([
        new CodingInterval(10, 15, true),
        new CodingInterval(16, 20, false)
      ]);

      expect(splitCodingExons([exon], new Interval(15, 20))).to.deep.equal([
        new CodingInterval(10, 14, false),
        new CodingInterval(15, 20, true)
      ]);
      done();
    });

    it('should handle purely coding or non-coding exons', function(done) {
      var exon = new Interval(10, 20);

      expect(splitCodingExons([exon], new Interval(0, 9))).to.deep.equal([
        new CodingInterval(10, 20, false)
      ]);
      expect(splitCodingExons([exon], new Interval(21, 25))).to.deep.equal([
        new CodingInterval(10, 20, false)
      ]);
      expect(splitCodingExons([exon], new Interval(10, 20))).to.deep.equal([
        new CodingInterval(10, 20, true)
      ]);
      done();
    });
  });
});
