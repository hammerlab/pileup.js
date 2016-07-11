/**
 * BBI is the shared structure between bigBed and bigWig.
 * These structures are based on UCSC's src/inc/bbiFile.h
 * @flow
 */

'use strict';

import {typeAtOffset} from './helpers';

var TYPE_SET = {
  'jBinary.littleEndian': true,

  'Header': {
    _magic: ['const', 'uint32', 0x8789F2EB, true],
    version: 'uint16',
    zoomLevels: 'uint16',
    chromosomeTreeOffset: 'uint64',
    unzoomedDataOffset: 'uint64',
    unzoomedIndexOffset: 'uint64',
    fieldCount: 'uint16',
    definedFieldCount: 'uint16',
    // 0 if no autoSql information
    autoSqlOffset: 'uint64',
    totalSummaryOffset: 'uint64',
    // Size of uncompression buffer.  0 if uncompressed.
    uncompressBufSize: 'uint32',
    // Offset to header extension 0 if no such extension
    // TODO: support extended headers (not used in ensGene.bb)
    extensionOffset: 'uint64',
    zoomHeaders: ['array', 'ZoomHeader', 'zoomLevels'],

    totalSummary: typeAtOffset('TotalSummary', 'totalSummaryOffset'),
    chromosomeTree: typeAtOffset('BPlusTree', 'chromosomeTreeOffset')
  },

  'TotalSummary': {
    basesCovered: 'uint64',
    minVal: 'float64',     // for bigBed minimum depth of coverage
    maxVal: 'float64',     // for bigBed maximum depth of coverage
    sumData: 'float64',    // for bigBed sum of coverage
    sumSquared: 'float64'  // for bigBed sum of coverage squared
  },

  'ZoomHeader': {
    reductionLevel: 'uint32',
    _reserved: 'uint32',
    dataOffset: 'uint64',
    indexOffset: 'uint64'
  },

  'BPlusTree': {
    magic: ['const', 'uint32', 0x78CA8C91, true],
    // Number of children per block (not byte size of block)
    blockSize: 'uint32',
    // Number of significant bytes in key
    keySize: 'uint32',
    // Number of bytes in value
    valSize: 'uint32',
    // Number of items in index
    itemCount: 'uint64',
    _reserved2: ['skip', 4],
    _reserved3: ['skip', 4],
    nodes: 'BPlusTreeNode'  // ['array', 'BPlusTreeNode', 'itemCount']
  },
  
  'BPlusTreeNode': {
    isLeaf: 'uint8',  // 1 = yes, 0 = no
    _reserved: 'uint8',
    count: 'uint16',
    contents: ['array', ['if', 'isLeaf', {
      key: ['string', 'keySize'],
      // Note: bigBed allows more general values; this is what Ensembl uses.
      // value: ['string', 'valSize']
      id: 'uint32',
      size: 'uint32'
    }, {
      key: ['string', 'keySize'],
      offset: 'uint64'
    }], 'count']
  },

  'CirTree': {
    _magic: ['const', 'uint32', 0x2468ACE0, true],
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

  'CirNode': {
    isLeaf: 'uint8',  // 1 = yes, 0 = no
    _reserved: 'uint8',
    count: 'uint16',
    contents: [
      'array', [
        'if', 'isLeaf', 'LeafData', 'NonLeafData'
      ],
      'count'
    ]
  },

  'LeafData': {
    startChromIx: 'uint32',
    startBase: 'uint32',
    endChromIx: 'uint32',
    endBase: 'uint32',
    offset: 'uint64',
    size: 'uint64'
  },

  'NonLeafData': {
    startChromIx: 'uint32',
    startBase: 'uint32',
    endChromIx: 'uint32',
    endBase: 'uint32',
    offset: 'uint64',
  },

  'BedEntry': {
    'chrId': 'uint32',
    'start': 'uint32',
    'stop': 'uint32',
    'rest': 'string0'
  },

  'BedBlock': ['array', 'BedEntry'],
};

module.exports = {TYPE_SET};
