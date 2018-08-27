/** @flow */
'use strict';

import {expect} from 'chai';

import _ from 'underscore';

import Interval from '../../main/Interval';
import TiledCanvas from '../../main/viz/TiledCanvas';

describe('TiledCanvas', function() {
  describe('getNewTileRanges', function() {
    var getNewTileRanges = TiledCanvas.getNewTileRanges;
    var iv = (a, b) => new Interval(a, b);

    it('should tile new ranges', function(done) {
      // The 0-100bp range gets enlarged & covered by a 0-500bp buffer.
      expect(getNewTileRanges([], iv(0, 100), 1))
          .to.deep.equal([iv(0, 499)]);

      // A large range requires multiple buffers.
      expect(getNewTileRanges([], iv(0, 800), 1))
          .to.deep.equal([iv(  0, 499),
                          iv(500, 999)]);

      // A gap gets filled.
      expect(getNewTileRanges([iv(0, 200), iv(400, 800)], iv(0, 800), 1))
          .to.deep.equal([iv(201, 399)]);

      // There's an existing tile in the middle of the new range.
      expect(getNewTileRanges([iv(0, 200), iv(400, 700)], iv(350, 750), 1))
          .to.deep.equal([iv(201, 399), iv(701, 999)]);
      done();
    });

    function intervalsAfterPanning(seq: Interval[], pxPerBase: number): Interval[] {
      var tiles = [];
      seq.forEach(range => {
        tiles = tiles.concat(getNewTileRanges(tiles, range, pxPerBase));
        tiles = _.sortBy(tiles, iv => iv.start);
      });
      return tiles;
    }

    it('should generate a small number of tiles while panning', function(done) {
      // This simulates a sequence of views that might result from panning.
      // Start at [100, 500], pan to the left, then over to the right.
      expect(intervalsAfterPanning(
            [iv(100, 500),
             iv( 95, 495),
             iv( 85, 485),
             iv( 75, 475),
             iv( 15, 415),
             iv( 70, 470),
             iv(101, 501),
             iv(110, 510),
             iv(120, 520),
             iv(600, 1000),
             iv(610, 1010)], 1))
          .to.deep.equal([iv(0, 499), iv(500, 999), iv(1000, 1499)]);
      done();
    });

    it('should not leave gaps with non-integer pixels per base', function(done) {
      var pxPerBase = 1100 / 181;  // ~6.077 px/bp -- very awkward!
      expect(intervalsAfterPanning(
            [iv(100, 300),
             iv( 95, 295),
             iv( 85, 285),
             iv( 75, 275),
             iv( 15, 215),
             iv( 70, 270),
             iv(101, 301),
             iv(110, 310),
             iv(120, 320),
             iv(600, 800),
             iv(610, 810)], pxPerBase))
          .to.deep.equal([
              // These tiles are somewhat arbitrary.
              // What's important is that they're integers with no gaps.
              iv(  0, 82),
              iv( 83, 165),
              iv(166, 248),
              iv(249, 331),
              iv(581, 663),
              iv(664, 746),
              iv(747, 829)
            ]);
        done();
    });
  });
});
