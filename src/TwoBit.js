/**
 * This module defines a parser for the 2bit file format.
 * See http://genome.ucsc.edu/FAQ/FAQformat.html#format7
 * @flow
 */
'use strict';

var Q = require('q'),
    _ = require('underscore');

var ReadableView = require('./ReadableView'),
    RemoteFile = require('./RemoteFile');

var BASE_PAIRS = [
  'T',  // 0=00
  'C',  // 1=01
  'A',  // 2=10
  'G'   // 3=11
];

type FileIndexEntry = {
  name: string;
  offset: number;
};

type SequenceRecord = {
  numBases: number;
  unknownBlockStarts: Array<number>;  // nb these numbers are 0-based
  unknownBlockLengths: Array<number>;  // TODO(danvk): add an interval type?
  numMaskBlocks: number;
  maskBlockStarts: Array<number>;
  maskBlockLengths: Array<number>;
  dnaOffsetFromHeader: number;  // # of bytes from sequence header to packed DNA
  offset: number;  // bytes from the start of the file at which this data lives.
}

type TwoBitHeader = {
  sequenceCount: number;
  reserved: number;
  sequences: Array<FileIndexEntry>;
}

var TWO_BIT_MAGIC = 0x1A412743;


/**
 * Parses a single SequenceRecord from the start of the ArrayBuffer.
 * fileOffset is the position of this sequence within the 2bit file.
 */
function parseSequenceRecord(dataView: DataView, fileOffset: number): SequenceRecord {
  var bytes = new ReadableView(dataView);
  var dnaSize = bytes.readUint32(),
      nBlockCount = bytes.readUint32(),
      nBlockStarts = bytes.readUint32Array(nBlockCount),
      nBlockSizes = bytes.readUint32Array(nBlockCount),
      // The masks can be quite large (~2MB for chr1) and we mostly don't care
      // about them.  So we ignore them, but we do need to know their length.
      maskBlockCount = bytes.readUint32();
      // maskBlockCount maskBlockStarts = bytes.readUint32Array(maskBlockCount),
      // maskBlockSizes = bytes.readUint32Array(maskBlockCount),
      // reserved = bytes.readUint32();

  var dnaOffset = bytes.tell() + 8 * maskBlockCount + 4;

  return {
    numBases: dnaSize,
    unknownBlockStarts: nBlockStarts,
    unknownBlockLengths: nBlockSizes,
    numMaskBlocks: maskBlockCount,
    maskBlockStarts: [],
    maskBlockLengths: [],
    dnaOffsetFromHeader: dnaOffset,
    offset: fileOffset
  };
}


/**
 * Parses the 2bit file header.
 */
function parseHeader(dataView: DataView): TwoBitHeader {
  var bytes = new ReadableView(dataView);
  var magic = bytes.readUint32();
  if (magic != TWO_BIT_MAGIC) {
    throw 'Invalid magic';
  }
  var version = bytes.readUint32();
  if (version != 0) {
    throw 'Unknown version of 2bit';
  }
  var sequenceCount = bytes.readUint32(),
      reserved = bytes.readUint32();

  var sequences: Array<FileIndexEntry> = [];
  for (var i = 0; i < sequenceCount; i++) {
    var nameSize = bytes.readUint8();
    var name = bytes.readAscii(nameSize);
    var offset = bytes.readUint32();
    sequences.push({name, offset});
  }
  // hg19 header is 1671 bytes to this point

  return {
    sequenceCount,
    reserved,
    sequences
  };
}


/**
 * Read 2-bit encoded base pairs from a DataView into an array of 'A', 'T',
 * 'C', 'G' strings.
 * These are returned as an array (rather than a string) to facilitate further
 * modification.
 */
function unpackDNA(dataView: DataView, startBasePair: number, numBasePairs: number): Array<string> {
  var basePairs: Array<string> = [];
  basePairs.length = dataView.byteLength * 4;  // pre-allocate
  var basePairIdx = -startBasePair;
  for (var i = 0; i < dataView.byteLength; i++) {
    var packed = dataView.getUint8(i);
    for (var shift = 6; shift >= 0; shift -= 2) {
      var bp = BASE_PAIRS[(packed >> shift) & 3];
      if (startBasePair >= 0) {
        basePairs[basePairIdx] = bp;
      }
      basePairIdx++;
    }
  }
  // Remove base pairs from the end if the sequence terminated mid-byte.
  basePairs.length = numBasePairs;
  return basePairs;
}

/**
 * Change base pairs to 'N' where the SequenceRecord dictates.
 * This modifies the basePairs array in-place.
 */
function markUnknownDNA(basePairs: Array<string>, dnaStartIndex: number, sequence: SequenceRecord): Array<string> {
  var dnaStop = dnaStartIndex + basePairs.length - 1;
  for (var i = 0; i < sequence.unknownBlockStarts.length; i++) {
    var nStart = sequence.unknownBlockStarts[i],
        nLength = sequence.unknownBlockLengths[i],
        nStop = nStart + nLength - 1,
        intStart = Math.max(nStart, dnaStartIndex),
        intStop = Math.min(nStop, dnaStop);
    if (intStop < intStart) continue;  // no overlap

    for (var j = intStart; j <= intStop; j++) {
      basePairs[j - dnaStartIndex] = 'N';
    }
  }

  return basePairs;
}


class TwoBit {
  remoteFile: RemoteFile;
  header: Q.Promise<TwoBitHeader>;

  constructor(url: string) {
    this.remoteFile = new RemoteFile(url);
    var deferredHeader = Q.defer();
    this.header = deferredHeader.promise;

    // TODO: if 16k is insufficient, fetch the right amount.
    this.remoteFile.getBytes(0, 16*1024).then(function(buffer) {
        var header = parseHeader(new DataView(buffer));
        deferredHeader.resolve(header);
      }).done();
  }

  // Returns the base pairs for contig:start-stop. The range is inclusive.
  getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<string> {
    if (start > stop) {
      throw `Requested a 2bit range with start > stop (${start}, ${stop})`;
    }

    start--;  // switch to zero-based indices
    stop--;
    return this._getSequenceHeader(contig).then(header => {
      var dnaOffset = header.offset + header.dnaOffsetFromHeader;
      var offset = Math.floor(dnaOffset + start/4);
      var byteLength = Math.ceil((stop - start + 1) / 4) + 1;
      return this.remoteFile.getBytes(offset, byteLength).then(buffer => {
        var dataView = new DataView(buffer);
        return markUnknownDNA(
            unpackDNA(dataView, start % 4, stop - start + 1), start, header)
            .join('');
      });
    });
  }

  // Returns a list of contig names.
  getContigList(): Q.Promise<string[]> {
    return this.header.then(header => header.sequences.map(seq => seq.name));
  }

  _getSequenceHeader(contig: string): Q.Promise<SequenceRecord> {
    return this.header.then(header => {
      var maybeSeq = _.findWhere(header.sequences, {name: contig}) ||
                     _.findWhere(header.sequences, {name: 'chr' + contig});
      if (maybeSeq == null) {
        throw 'Invalid contig: ' + contig;
      }
      var seq = maybeSeq;  // for flow, see facebook/flow#266

      // TODO: if 4k is insufficient, fetch the right amount.
      return this.remoteFile.getBytes(seq.offset, 4095).then(
          buf => parseSequenceRecord(new DataView(buf), seq.offset));
    });
  }
}

module.exports = TwoBit;
