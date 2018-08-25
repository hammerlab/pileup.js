/* @flow */
'use strict';

import {expect} from 'chai';

import jBinary from 'jbinary';
import helpers from '../main/data/formats/helpers';

describe('jBinary Helpers', function() {
  it('should read sized blocks', function(done) {
    //                       5  -------------  3  -------  4  ----------
    var u8 = new Uint8Array([5, 1, 2, 3, 4, 5, 3, 1, 2, 3, 4, 1, 2, 3, 4]);
    var TYPE_SET = {
      'jBinary.littleEndian': true,
      'File': ['array', {
        length: 'uint8',
        contents: [helpers.sizedBlock, ['array', 'uint8'], 'length']
      }]
    };

    var jb = new jBinary(u8, TYPE_SET);
    var o = jb.read('File');
    expect(o).to.deep.equal([
      {length: 5, contents: [1, 2, 3, 4, 5]},
      {length: 3, contents: [1, 2, 3]},
      {length: 4, contents: [1, 2, 3, 4]}
    ]);
    done();
  });

  it('should read fixed-size null-terminated strings', function(done) {
    //                        A   B   C   D      B,  C
    var u8 = new Uint8Array([65, 66, 67, 68, 0, 66, 67, 0, 0, 0]);

    var jb = new jBinary(u8);
    var o = jb.read(['array', [helpers.nullString, 5]]);
    expect(o).to.deep.equal(['ABCD', 'BC']);
    done();
  });

  it('should read arrays of simple types lazily', function(done) {
    var numReads = 0;
    var countingUint8 = jBinary.Template({
      baseType: 'uint8',
      read() {
        numReads++;
        return this.baseRead();
      }
    });

    var u8 = new Uint8Array([65, 66, 67, 68, 1, 2, 3, 4, 5, 6]);
    var jb = new jBinary(u8);
    var o = jb.read([helpers.lazyArray, countingUint8, 1, 10]);
    expect(o.length).to.equal(10);
    expect(numReads).to.equal(0);
    expect(o.get(0)).to.equal(65);
    expect(numReads).to.equal(1);
    expect(o.get(1)).to.equal(66);
    expect(numReads).to.equal(2);
    expect(o.get(9)).to.equal(6);
    expect(numReads).to.equal(3);
    done();
  });

  it('should read arrays of objects lazily', function(done) {
    var u8 = new Uint8Array([65, 66, 67, 68, 1, 2, 3, 4, 5, 6]);
    var jb = new jBinary(u8);
    var o = jb.read([helpers.lazyArray, {x: 'uint8', y: 'uint8'}, 2, 5]);
    expect(o.length).to.equal(5);
    expect(o.get(0)).to.deep.equal({x: 65, y: 66});
    expect(o.get(1)).to.deep.equal({x: 67, y: 68});
    expect(o.get(4)).to.deep.equal({x: 5, y: 6});
    done();
  });

  it('should read the entire array lazily', function(done) {
    //                        A   B   C   D      B,  C
    var u8 = new Uint8Array([65, 66, 67, 68, 0, 66, 67, 0, 0, 0]);

    var jb = new jBinary(u8);
    var o = jb.read([helpers.lazyArray, [helpers.nullString, 5], 5, 2]);
    expect(o.getAll()).to.deep.equal(['ABCD', 'BC']);
    done();
  });

  it('should read uint64s as native numbers', function(done) {
    var TYPE_SET = {
      'jBinary.littleEndian': true,
      uint64native: helpers.uint64native
    };
    var u8big   = new jBinary([0x41, 0x42, 0x43, 0xF3, 0x04, 0x24, 0x30, 0x00], TYPE_SET),
        u8small = new jBinary([0x00, 0x00, 0x43, 0xF3, 0x04, 0x00, 0x00, 0x00], TYPE_SET);
    // TODO: test a few numbers right on the edge
    // TODO: test number that wraps around to negative as a float

    expect(() => u8big.read('uint64native')).to.throw(RangeError);
    expect(u8small.read('uint64native')).to.equal(21261123584);
    done();
  });
});
