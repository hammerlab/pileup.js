/**
 * TwoBit is a packed genome format.
 * See http://genome.ucsc.edu/FAQ/FAQformat.html#format7
 * @flow
 */

'use strict';

var TYPE_SET = {
  'jBinary.littleEndian': true,

  'Header': {
    magic: ['const', 'uint32', 0x1A412743, true],
    version: ['const', 'uint32', 0, true],
    sequenceCount: 'uint32',
    reserved: 'uint32',

    sequences: ['array', 'SequenceHeader', 'sequenceCount']
  },

  'SequenceHeader': {
    nameSize: 'uint8',
    name: ['string', 'nameSize'],
    offset: 'uint32'
  },

  'SequenceRecord': {
    dnaSize: 'uint32',
    nBlockCount: 'uint32',
    nBlockStarts: ['array', 'uint32', 'nBlockCount'],
    nBlockSizes: ['array', 'uint32', 'nBlockCount'],
    // The masks can be quite large (~2MB for chr1) and we mostly don't care
    // about them.  So we ignore them, but we do need to know their length.
    maskBlockCount: 'uint32',
    // maskBlockStarts: ['array', 'uint32', 'maskBlockCount']
    // maskBlockSizes: ['array', 'uint32', 'maskBlockCount']
    // reserved: 'uint32'
  }
};

module.exports = {TYPE_SET};
