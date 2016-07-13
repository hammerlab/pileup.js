/**
 * BBI is the shared structure between bigBed and bigWig.
 * These structures are based on UCSC's src/inc/bbiFile.h
 * @flow
 */

'use strict';

import _ from 'underscore';

var BigBedHeader = {
  _magic: [ 'const', 'uint32', 0x8789F2EB, true ],
  version: 'uint16',
  zoomLevels: ['const', 'uint16', 0 ],
  chromosomeTreeOffset: 'uint64',
  unzoomedDataOffset: 'uint64',
  unzoomedIndexOffset: 'uint64',
  fieldCount: 'uint16',
  definedFieldCount: 'uint16',
  // 0 if no autoSql information
  autoSqlOffset: 'uint64',
  totalSummaryOffset: 'uint64',  // TODO: restrict to version ≥ 2. Is it relevant at all in BigBed?

  // Size of uncompression buffer.  0 if uncompressed.
  uncompressBufSize: 'uint32',

  // Offset to header extension 0 if no such extension
  // TODO: support extended headers (not used in ensGene.bb); spec calls this block simply 'reserved'.
  extensionOffset: 'uint64',
};

var BigWigHeader = _.extend({}, BigBedHeader);
BigWigHeader.magic = [ 'const', 'uint32', 0x888FFC26, true ];
BigWigHeader.zoomLevels = 'uint16';
BigWigHeader.fieldCount = [ 'const', 'uint16', 0, true ];
BigWigHeader.definedFieldCount = [ 'const', 'uint16', 0, true ];
BigWigHeader.autoSqlOffset = [ 'const', 'uint64', 0, true ];

var CirTree = {

  // The "CIR" tree contains a mapping from sequence -> block offsets; it stands for "Chromosome Index R tree".
  CirTree: {
    _magic: [ 'const', 'uint32', 0x2468ACE0, true ],
    blockSize: 'uint32',
    itemCount: 'uint64',
    startChromIx: 'uint32',
    startBase: 'uint32',
    endChromIx: 'uint32',
    endBase: 'uint32',
    fileSize: 'uint64',
    itemsPerSlot: 'uint32',
    _reserved: ['skip', 4],
    blocks: 'CirNode'
  },

  CirNode: {
    isLeaf: 'uint8',  // 1 = yes, 0 = no
    _reserved: 'uint8',
    count: 'uint16',
    contents: [
      'array',
      [ 'if', 'isLeaf', 'LeafData', 'NonLeafData' ],
      'count'
    ]
  },

  LeafData: {
    startChromIx: 'uint32',
    startBase: 'uint32',
    endChromIx: 'uint32',
    endBase: 'uint32',
    offset: 'uint64',
    size: 'uint64'
  },

  NonLeafData: {
    startChromIx: 'uint32',
    startBase: 'uint32',
    endChromIx: 'uint32',
    endBase: 'uint32',
    offset: 'uint64'
  },
};

var ChromTreeNode = {
  isLeaf: 'uint8',  // 1 = yes, 0 = no
  _reserved: 'uint8',
  count: 'uint16',
  contents: [
    'array',
    [
      'if',
      'isLeaf',
      {
        key: [ 'string', 'keySize' ],
        
        // Note: bigBed allows more general values; this is what Ensembl uses.
        // value: ['string', 'valSize']
        id: 'uint32',
        size: 'uint32'
      },
      {
        key: [ 'string', 'keySize' ],
        offset: 'uint64'
      }
    ],
    'count'
  ]
};

var ChromTree = {
  magic: [ 'const', 'uint32', 0x78CA8C91, true ],

  // Number of children per block (not byte size of block)
  blockSize: 'uint32',

  // Number of significant bytes in key
  keySize: 'uint32',

  // Number of bytes in value
  valSize: 'uint32',

  // Number of items in index
  itemCount: 'uint64',

  _reserved: [ 'skip', 8 ],
  root: ChromTreeNode
};

var TotalSummary = {
  basesCovered: 'uint64',
  minVal: 'float64',     // for bigBed minimum depth of coverage
  maxVal: 'float64',     // for bigBed maximum depth of coverage
  sumData: 'float64',    // for bigBed sum of coverage
  sumSquared: 'float64'  // for bigBed sum of coverage squared
};

var BedBlockTypeSet = {
  Entry: {
    chrId: 'uint32',
    start: 'uint32',
    stop: 'uint32',
    rest: 'string0'
  },

  Block: [ 'array', 'Entry' ]
};

var ZoomHeader = {
  reductionLevel: 'uint32',
    _reserved: 'uint32',
    dataOffset: 'uint64',
    indexOffset: 'uint64'
};

var BigWigData = {
  FixedData: {
    value: 'float32'
  },

  VarData: {
    start: 'uint32',
    value: 'float32'
  },

  BedGraphData: {
    start: 'uint32',
    end: 'uint32',
    value: 'float32'
  },

  Data: {
    chrId: 'uint32',
    start: 'uint32',
    stop: 'uint32',
    step: 'uint32',
    span: 'uint32',
    tpe: 'uint8',
    reserved: 'uint8',
    count: 'uint16',
    data: [
      'array',
      [
        'if',
        (ctx) => {
          return ctx.tpe == 1;
        },
        'FixedData',
        [
          'if',
          (ctx) => {
            return ctx.tpe == 2;
          },
          'VarData',
          [
            'if',
            (ctx) => {
              return ctx.tpe == 3;
            },
            'BedGraphData',
            'BedGraphData'  // TODO(ryan): should be an error…
          ]
        ]
      ],
      'count'
    ]
  },
};

var ZoomData = {
  chrId: 'uint32',
  start: 'uint32',
  end: 'uint32',
  validCount: 'uint32',
  minVal: 'uint32',
  maxVal: 'uint32',
  sum: 'uint32',
  sumSqs: 'uint32'
};

module.exports = {
  BigBedHeader,
  BigWigHeader,
  BigWigData,
  BedBlockTypeSet,
  ChromTree,
  CirTree,
  TotalSummary,
  ZoomData,
  ZoomHeader
};

// Make everything little-endian by default. TODO: infer this from the file's "magic" field.
_.map(module.exports, (v, k) => {
  v['jBinary.littleEndian'] = true;
});

console.log("bbi:", module.exports);