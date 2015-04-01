/**
 * Binary formats for BAM files.
 * See https://samtools.github.io/hts-specs/SAMv1.pdf
 * @flow
 */

'use strict';

var jBinary = require('jbinary');
var _ = require('underscore');

var {sizedBlock, nullString} = require('./helpers');

var SEQUENCE_VALUES = ['=', 'A', 'C', 'M', 'G', 'R', 'S', 'V', 'T', 'W', 'Y', 'H', 'K', 'D', 'B', 'N'];
var CIGAR_OPS = ['M', 'I', 'D', 'N', 'S', 'H', 'P', '=', 'X'];


// Core alignment fields shared between BamAlignments and ThinBamAlignments.
// TODO: figure out why jBinary's 'extend' type doesn't work with this in TYPE_SET.
var ThinAlignment = {
  refID: 'int32',
  pos: 'int32',
  l_read_name: 'uint8',
  MAPQ: 'uint8',
  bin: 'uint16',
  n_cigar_op: 'uint16',
  FLAG: 'uint16',
  l_seq: 'int32',
  next_refID: 'int32',
  next_pos: 'int32',
  tlen: 'int32'
};

var TYPE_SET: any = {
  'jBinary.littleEndian': true,

  'BamHeader': {
    _magic: ['const', ['string', 4], 'BAM\u0001', true],
    l_text: 'int32',
    text: ['string', 'l_text'],
    n_ref: 'int32',
    references: ['array', {
      l_name: 'int32',
      name: [nullString, 'l_name'],
      l_ref: 'int32'
    }, 'n_ref']
  },

  'BamAlignments': {
    block_size: 'int32',
    contents: [sizedBlock, _.extend({}, ThinAlignment, {
      read_name: [nullString, 'l_read_name'],
      cigar: ['array', 'CigarOp', 'n_cigar_op'],
      seq: ['FourBitSequence', 'l_seq'],
      qual: ['array', 'uint8', 'l_seq'],  // 255 = unknown
      auxiliary: ['array', {
        tag: ['string', 2],
        val_type: 'char',
        value: ['if', ctx => ctx.val_type == 'B', {
                 val_type: 'char',
                 num_values: 'int32',
                 values: ['array', 'AuxiliaryValue', 'num_values']
                }, 'AuxiliaryValue']
      }]  // goes until the end of the block
    }), 'block_size']
  },

  'ThinBamAlignments': {
    block_size: 'int32',
    contents: [sizedBlock, ThinAlignment, 'block_size']
  },

  // TODO: make a "case" construct for jBinary & implement the rest of these.
  'AuxiliaryValue':
    ['if', ctx => ctx.val_type == 'A', 'char',
    ['if', ctx => ctx.val_type == 'c', 'int8',
    ['if', ctx => ctx.val_type == 'C', 'uint8',
    ['if', ctx => ctx.val_type == 's', 'int16',
    ['if', ctx => ctx.val_type == 'S', 'uint16',
    ['if', ctx => ctx.val_type == 'i', 'int32',
    ['if', ctx => ctx.val_type == 'I', 'uint32',
    ['if', ctx => ctx.val_type == 'f', 'float32',
    ['if', ctx => ctx.val_type == 'Z', 'string0',
    // TODO: 'H' = byte array in hex format
    ['skip', 0]]]]]]]]],
  ],

  // "CIGAR: op len<<4|op. ‘MIDNSHP=X’→‘012345678’"
  // TODO: it may be possible to read this declaratively with a bitfield type.
  'CigarOp': jBinary.Template({
    baseType: 'uint32',
    read(context) {
      var v = this.baseRead();
      return {
        length: v >> 4,
        op: CIGAR_OPS[v & 0xf]
      };
    }
  }),

  // "4-bit encoded read: ‘=ACMGRSVTWYHKDBN’→ [0, 15]; other characters mapped
  // to ‘N’; high nybble first (1st base in the highest 4-bit of the 1st byte)"
  'FourBitSequence': jBinary.Template({
    setParams(lengthField) {
      this.lengthField = lengthField;
      var numBytes = ctx => Math.floor((+ctx[lengthField] + 1) / 2);
      this.baseType = ['array', 'uint8', numBytes];
    },
    read(ctx) {
      var numBases = +ctx[this.lengthField];
      var vals = this.baseRead();
      return vals.map((b, i) => {
        return SEQUENCE_VALUES[b >> 4] +
               (2 * i + 1 < numBases ? SEQUENCE_VALUES[b & 0xf] : '');
      }).join('');
    }
  }),

  'BamFile': {
    header: 'BamHeader',
    alignments: ['array', 'BamAlignments']
  },

  'ThinBamFile': {
    header: 'BamHeader',
    alignments: ['array', 'ThinBamAlignments']
  },

  // BAI index formats
  // See https://samtools.github.io/hts-specs/SAMv1.pdf
  // TODO: make a "uint64small" type for when we know it's < 2^53
  'BaiIndex': {
    n_bin: 'int32',
    bins: ['array', {
      bin: 'uint32',
      n_chunk: 'int32',
      chunks: ['array', {
        chunk_beg: 'uint64',
        chunk_end: 'uint64'
      }, 'n_chunk']
    }, 'n_bin'],
    n_intv: 'int32',
    intervals: ['array', {
      ioffset: 'uint64'
    }, 'n_intv']
  },

  'BaiFile': {
    magic: ['const', ['string', 4], 'BAI\u0001'],
    n_ref: 'int32',
    indices: ['array', 'BaiIndex', 'n_ref'],
    n_no_coor: 'uint64'  // spec says optional, but it's always there.
  }
};


module.exports = {TYPE_SET};
