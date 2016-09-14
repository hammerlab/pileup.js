/* @flow */
'use strict';

import chai from 'chai';
var expect = chai.expect;

import chaiSubset from 'chai-subset';
chai.use(chaiSubset);

import BigWig from '../../main/data/BigWig';

describe('BigWig', function() {

  var { bw } = BigWig.load('/test-data/bigWigExample.bw');

  function test(name, fn) {
    it(name, (done) => {
      bw.then(bw => {
        fn(bw);
        done();
      }).done();
    });
  }

  test("should parse header", (bw) => {
    expect(bw.header).to.containSubset({
      _magic: 0x888ffc26,
      version: 1,
      numZoomLevels: 7,
      autoSqlOffset: { lo: 0, hi: 0 },
      definedFieldCount: 0,
      fieldCount: 0,
      uncompressBufSize: 0,
      totalSummaryOffset: { lo: 0 , hi: 0 },
      extensionOffset: { lo: 0, hi: 0 },
      chromosomeTreeOffset: { lo: 232, hi: 0 },
      unzoomedDataOffset: { lo: 281, hi: 0 },
      unzoomedIndexOffset: { lo: 56335581, hi: 0 },
    });
  });

  test("should parse index", (bw) => {
    var index = bw.index;

    expect(index).to.containSubset({
      _magic: 0x2468ACE0,
      branchingFactor: 256,
      dataEndOffset: { lo: 56335581, hi: 0 },
      startChromIx: 0,
      startBase: 9411190,
      endChromIx: 0,
      endBase: 48119895,
      numDataBlocks: { lo: 6857, hi: 0 },
      numItemsPerDataBlock: 1
    });

    var root = index.root;
    expect(root.childPointers).to.have.length(27);
    expect(root.children).to.have.length(27);
    expect(root).to.containSubset({
      isLeaf: 0,
      childPointers: {
        0: {
          startChromIx: 0,
          startBase: 9411190,
          endChromIx: 0,
          endBase: 11071890,
          offset: { lo: 56341777, hi: 0 }
        },
        26: {
          startChromIx: 0,
          startBase: 47091910,
          endChromIx: 0,
          endBase: 48119895,
          offset: { lo: 56554873, hi: 0 }
        }
      }
    });

    expect(root.children[0].dataPointers).to.have.length(256);
    expect(root.children[0]).to.containSubset({
      isLeaf: 1,
      count: 256,
      dataPointers: {
        0: {
          startChromIx: 0,
          startBase: 9411190,
          endChromIx: 0,
          endBase: 9416310,
          offset: { lo: 285, hi: 0 },
          size: { lo: 8216, hi: 0 }
        },
        255: {
          startChromIx: 0,
          startBase: 11066770,
          endChromIx: 0,
          endBase: 11071890,
          offset: { lo: 2095365, hi: 0 },
          size: { lo: 8216, hi: 0 }
        }
      }
    });

    expect(root.children[26].dataPointers).to.have.length(201);
    expect(root.children[26]).to.containSubset({
      isLeaf: 1,
      count: 201,
      dataPointers: {
        0: {
          startChromIx: 0,
          startBase: 47091910,
          endChromIx: 0,
          endBase: 47097030,
          offset: { lo: 54685981, hi: 0 },
          size: { lo: 8216, hi: 0 }
        },
        200: {
          startChromIx: 0,
          startBase: 48115910,
          endChromIx: 0,
          endBase: 48119895,
          offset: { lo: 56329181, hi: 0 },
          size: { lo: 6400, hi: 0 }
        }
      }
    });
  });

  test('should parse contigMap', (bw) => {
    expect(bw.contigMap).to.deep.equal({ chr21: 0 });
  });

  test('should parse zoom indices', (bw) => {
    expect(bw.zoomIndices).to.have.length(7);
  });
});
