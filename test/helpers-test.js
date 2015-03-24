/* @flow */
'use strict';

var chai = require('chai');
var expect = chai.expect;

var jBinary = require('jbinary');
var helpers = require('../src/formats/helpers');

describe('jBinary Helpers', function() {
  it('should read sized blocks', function() {
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
  });

  it('should read fixed-size null-terminated strings', function() {
    //                        A   B   C   D      B,  C
    var u8 = new Uint8Array([65, 66, 67, 68, 0, 66, 67, 0, 0, 0]);

    var jb = new jBinary(u8);
    var o = jb.read(['array', [helpers.nullString, 5]]);
    expect(o).to.deep.equal(['ABCD', 'BC']);
  });
});
