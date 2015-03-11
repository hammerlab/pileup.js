/**
 * Parser for bigBed format.
 * Based on UCSC's src/inc/bbiFile.h
 */
'use strict';

var Q = require('q'),
    _ = require('underscore'),
    jBinary = require('jbinary'),
    pako = require('pako');  // for gzip inflation
    

var ReadableView = require('./ReadableView'),
    RemoteFile = require('./RemoteFile');

function typeAtOffset(typeName, offsetFieldName) {
  return jBinary.Template({
      baseType: typeName,
      read: function(context) {
        if (+context[offsetFieldName] == 0) {
          return null;
        } else {
          return this.binary.read(this.baseType, +context[offsetFieldName]);
        }
      }
    });
}

var BigBedTypeSet = {
  'jBinary.all': 'File',
  'jBinary.littleEndian': true,

  'File': {
    _magic: ['const', 'uint32', 0x8789F2EB, true],
    version: ['const', 'uint16', 4, true],
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
  }
};

var CirTreeTypeSet = {
  'jBinary.all': 'File',
  'jBinary.littleEndian': true,

  'File': {
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
    contents: ['array', ['if', 'isLeaf', {
      startChromIx: 'uint32',
      startBase: 'uint32',
      endChromIx: 'uint32',
      endBase: 'uint32',
      offset: 'uint64',
      size: 'uint64'
    }, {
      startChromIx: 'uint32',
      startBase: 'uint32',
      endChromIx: 'uint32',
      endBase: 'uint32',
      offset: 'uint64',
    }], 'count']
  }
};


var BigBedBlock = {
  'jBinary.all': 'File',
  'jBinary.littleEndian': true,

  'File': ['array', 'BedEntry'],
  'BedEntry': {
    'chrId': 'uint32',
    'start': 'uint32',
    'end': 'uint32',
    'rest': 'string0'
  }
};


function parseHeader(dataView: DataView) {
  // TODO: check Endianness using magic. Possibly use jDataView.littleEndian
  // to flip the endianness for jBinary consumption.
  // NB: dalliance doesn't support big endian formats.
  var jb = new jBinary(dataView.buffer, BigBedTypeSet);
  var header = jb.readAll();
  console.log(header);

  return header;
}

function parseCirTree(dataView: DataView) {
  var jb = new jBinary(dataView.buffer, CirTreeTypeSet);
  var cirTree = jb.readAll();
  console.log(cirTree);

  return cirTree;
}

function generateContigMap(twoBitHeader): {[key:string]: number} {
  // Just assume it's a flat "tree" for now.
  var nodes = twoBitHeader.chromosomeTree.nodes.contents;
  if (!nodes) {
    throw 'Invalid chromosome tree';
  }
  return _.object(nodes.map(function({id, key}) {
    // remove trailing nulls from the key string
    return [key.replace(/\0.*/, ''), id];
  }));
}

function getContigId(contigMap, contig) {
  return contigMap[contig] || contigMap['chr' + contig] || null;
}

function intersectIntervals(intervals: Array<[number, number]>): [number, number] {
  if (!intervals.length) {
    throw 'Tried to intersect zero intervals';
  }
  var result = intervals[0];
  intervals.slice(1).forEach(function([a, b]) {
    result[0] = Math.min(a, result[0]);
    result[1] = Math.max(b, result[1]);
  });
  return result;
}

// TODO: factor out into module
var lessOrEqual = function(c1, p1, c2, p2) {
  return c1 < c2 || (c1 == c2 && p1 <= p2);
};
var contains = function(startContig, startPos, endContig, endPos, contig, pos) {
  return lessOrEqual(startContig, startPos, contig, pos) &&
         lessOrEqual(contig, pos, endContig, endPos);
};

var overlaps = function(startContig, startBase, endContig, endBase, contig, start, stop) {
  return contains(startContig, startBase, endContig, endBase, contig, start) ||
         contains(startContig, startBase, endContig, endBase, contig, stop);
};

// Get a byte range in the file containing a superset of the interval.
function findByteRange(twoBitHeader, cirTree, contigIx: number, start: number, stop: number): ?[number, number] {

  // Do a recursive search through the index tree
  var matchingIntervals = [];
  var find = function(node) {
    if (node.contents) {
      node.contents.forEach(find);
    } else {
      if (overlaps(node.startChromIx, node.startBase,
                   node.endChromIx, node.endBase,
                   contigIx, start, stop)) {
        matchingIntervals.push(node);
      }
    }
  };
  find(cirTree.blocks);

  return matchingIntervals;

  // Intersect the intervals.
  // XXX UCSC allows discontiguous intervals. When would this ever happen?
  return intersectIntervals(
      matchingIntervals.map(n => [+n.offset, n.offset+n.size]));
}

function extractFeaturesInRange(dataView, dataRange, blocks, contigIx, start, stop) {
  console.log('Fetched ', dataRange);
  var buffer = dataView.buffer;

  return _.flatten(blocks.map(block => {
    var blockOffset = block.offset - dataRange[0],
        blockLimit = blockOffset + block.size,
        // TODO: where does the +2 come from? (I copied it from dalliance)
        blockBuffer = buffer.slice(blockOffset + 2, blockLimit);
    // TODO: only inflate if necessary
    var inflatedBuffer = pako.inflateRaw(new Uint8Array(blockBuffer));

    var jb = new jBinary(inflatedBuffer, BigBedBlock);
    // TODO: parse only one record at a time, as many as is necessary.
    var beds = jb.readAll();

    console.log(beds);

    beds = beds.filter(function(bed) {
      return overlaps(bed.chrId, bed.start, bed.chrId, bed.end, contigIx, start, stop);
    });

    return beds;
  }));
}


class BigBed {
  remoteFile: RemoteFile;
  header: Q.Promise<any>;
  cirTree: Q.Promise<any>;

  constructor(url: string) {
    this.remoteFile = new RemoteFile(url);
    this.header = this.remoteFile.getBytes(0, 64*1024).then(parseHeader);
    this.contigMap = this.header.then(generateContigMap);

    // Next: fetch [header.unzoomedIndexOffset, zoomHeaders[0].dataOffset] and parse
    // the "CIR" tree.
    this.cirTree = this.header.then(header => {
      // zoomHeaders[0].dataOffset is the next entry in the file.
      // We assume the "cirTree" section goes all the way to that point.
      var start = header.unzoomedIndexOffset,
          length = header.zoomHeaders[0].dataOffset - start;
      return this.remoteFile.getBytes(start, length).then(parseCirTree);
    });
    
    // XXX: are these necessary? what's the right way to propagate errors?
    this.header.done();
    this.contigMap.done();
    this.cirTree.done();
  }

  // Returns all BED entries which overlap the range.
  // TODO: factor logic out into a helper
  getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<any> {
    return Q.spread([this.header, this.cirTree, this.contigMap],
                    (header, cirTree, contigMap) => {
      var contigIx = getContigId(contigMap, contig);
      if (contigIx === null) {
        throw `Invalid contig ${contig}`;
      }

      var blocks = findByteRange(header, cirTree, contigIx, start, stop);
      if (!blocks) {
        return null;  // XXX better to throw?
      }
      console.log(blocks);
      var range = intersectIntervals(blocks.map(n => [+n.offset, n.offset+n.size]));
      return this.remoteFile.getBytes(range[0], range[1] - range[0])
          .then(dataView => extractFeaturesInRange(dataView, range, blocks, contigIx, start, stop));
    });
  }
}

module.exports = BigBed;
