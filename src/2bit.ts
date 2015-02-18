/// <reference path="../typings/q/q.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
'use strict';

import ReadableView = require('./readableview');
import RemoteFile = require('./remotefile');

var BASE_PAIRS = [
  'T',  // 0=00
  'C',  // 1=01
  'A',  // 2=10
  'G'   // 3=11
];

interface FileIndexEntry {
  name: string;
  offset: number;
}

interface SequenceRecord {
  numBases: number;
  unknownBlockStarts: number[];  // nb these numbers are 0-based
  unknownBlockLengths: number[];  // TODO(danvk): add an interval type?
  numMaskBlocks: number
  maskBlockStarts: number[];
  maskBlockLengths: number[];
  dnaOffsetFromHeader: number;  // # of bytes from sequence header to packed DNA
  offset: number;  // bytes from the start of the file at which this data lives.
}

interface TwoBitHeader {
  sequenceCount: number;
  reserved: number;
  sequences: FileIndexEntry[];
}


var TWO_BIT_MAGIC = 0x1A412743;



/**
 * Parses a single SequenceRecord from the start of the ArrayBuffer.
 */
function parseSequenceRecord(dataView: DataView): SequenceRecord {
  var bytes = new ReadableView(dataView);
  var dnaSize = bytes.readUint32(),
      nBlockCount = bytes.readUint32(),
      nBlockStarts = bytes.readUint32Array(nBlockCount),
      nBlockSizes = bytes.readUint32Array(nBlockCount),
      // Can probably just ignore the mask fields?
      maskBlockCount = bytes.readUint32();
      // maskBlockStarts = bytes.readUint32Array(maskBlockCount),
      // maskBlockSizes = bytes.readUint32Array(maskBlockCount),
      // reserved = bytes.readUint32();
  // For chr1, dnaSize = 249250621
  // nBlockCount = 39
  // maskBlockCount = 325027
  // i.e. reading the whole header requires at least 2MB of data.

  var offset = bytes.tell() + 8 * maskBlockCount + 4;

  // DNA information comes after this.
  return {
    numBases: dnaSize,
    unknownBlockStarts: nBlockStarts,
    unknownBlockLengths: nBlockSizes,
    numMaskBlocks: maskBlockCount,
    maskBlockStarts: [],
    maskBlockLengths: [],
    dnaOffsetFromHeader: offset,
    offset: null  // unknown
  };
}


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

  var sequences: FileIndexEntry[] = [];
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


function unpackDNA(dataView: DataView, startBasePair: number, numBasePairs: number): string[] {
  var basePairs: string[] = [];
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

function markUnknownDNA(basePairs: string[], dnaStartIndex: number, sequence: SequenceRecord): string {
  var dnaStop = dnaStartIndex + basePairs.length - 1;
  for (var i = 0; i < sequence.unknownBlockStarts.length; i++) {
    var nStart = sequence.unknownBlockStarts[i],
        nLength = sequence.unknownBlockLengths[i],
        nStop = nStart + nLength - 1,
        intStart = Math.max(nStart, dnaStartIndex),
        intStop = Math.min(nStop, dnaStop);
    // console.log('dna: ', dnaStart, dnaStop, 'unknown: ', nStart, nStop, nStop - nStart + 1, 'int:', intStart, intStop, Math.max(0, intStop - intStart + 1));
    if (intStop < intStart) continue;  // no overlap

    for (var j = intStart; j <= intStop; j++) {
      basePairs[j - dnaStartIndex] = 'N';
    }
  }

  return basePairs.join('');
}


class TwoBit {
  remoteFile: RemoteFile;
  private header: Q.Promise<TwoBitHeader>;
  constructor(private url: string) {
    this.remoteFile = new RemoteFile(url);
    var deferredHeader = Q.defer<TwoBitHeader>();
    this.header = deferredHeader.promise;

    // TODO: if 16k is insufficient, fetch the right amount.
    this.remoteFile.getBytes(0, 16*1024).then(function(dataView) {
        var header = parseHeader(dataView);
        deferredHeader.resolve(header);
        console.log(header);
      }).done();
  }

  // Returns the base pairs for contig:start-stop. The range is inclusive.
  getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<string> {
    start--;  // switch to zero-based indices
    stop--;
    return this.getSequenceHeader(contig).then(header => {
      var dnaOffset = header.offset + header.dnaOffsetFromHeader;
      var offset = Math.floor(dnaOffset + start/4);
      var byteLength = Math.ceil((stop - start + 1) / 4) + 1;
      return this.remoteFile.getBytes(offset, byteLength).then(dataView => {
        return markUnknownDNA(
            unpackDNA(dataView, start % 4, stop - start + 1), start, header);
      });
    });
  }

  private getSequenceHeader(contig: string): Q.Promise<SequenceRecord> {
    return this.header.then(header => {
      var seq = _.findWhere(header.sequences, {name: contig}) ||
                _.findWhere(header.sequences, {name: 'chr' + contig});
      if (!seq) {
        throw 'Invalid contig: ' + contig;
      }

      // TODO: if 4k is insufficient, fetch the right amount.
      return this.remoteFile.getBytes(seq.offset, 4095).then(dataView => {
        var rec = parseSequenceRecord(dataView);
        rec.offset = seq.offset;
        return rec;
      });
    });
  }
}

export = TwoBit;
