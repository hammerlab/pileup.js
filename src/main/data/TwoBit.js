/**
 * This module defines a parser for the 2bit file format.
 * See http://genome.ucsc.edu/FAQ/FAQformat.html#format7
 * @flow
 */
'use strict';

import type RemoteFile from '../RemoteFile';

import Q from 'q';
import _ from 'underscore';
import jBinary from 'jbinary';

import twoBitTypes from './formats/twoBitTypes';

var BASE_PAIRS = [
  'T',  // 0=00
  'C',  // 1=01
  'A',  // 2=10
  'G'   // 3=11
];

/**
  The following chunk sizes are optimized against
  the human reference genome (hg19.2bit). Assuming that
  pileup.js is mostly being used for human genome,
  increasing the following numbers might cause nonnecessary
  network traffic and might also break our unit tests
  that make use of mapped 2bit files.
*/
var FIRST_HEADER_CHUNKSIZE = 16 * 1024,  // 16 KB
    FIRST_SEQUENCE_CHUNKSIZE = (4 * 1024) - 1,  // ~ 4KB
    MAX_CHUNKSIZE = 1024 * 1024;  // 1 MB

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
  sequences: Array<FileIndexEntry>;
}


/**
 * Parses a single SequenceRecord from the start of the ArrayBuffer.
 * fileOffset is the position of this sequence within the 2bit file.
 */
function parseSequenceRecord(buffer: ArrayBuffer, fileOffset: number): SequenceRecord {
  var jb = new jBinary(buffer, twoBitTypes.TYPE_SET);
  var header = jb.read('SequenceRecord');

  var dnaOffset = jb.tell() + 8 * header.maskBlockCount + 4;

  return {
    numBases: header.dnaSize,
    unknownBlockStarts: header.nBlockStarts,
    unknownBlockLengths: header.nBlockSizes,
    numMaskBlocks: header.maskBlockCount,
    maskBlockStarts: [],
    maskBlockLengths: [],
    dnaOffsetFromHeader: dnaOffset,
    offset: fileOffset
  };
}


function parseHeader(buffer: ArrayBuffer): TwoBitHeader {
  var jb = new jBinary(buffer, twoBitTypes.TYPE_SET);
  var header = jb.read('Header');

  return {
    sequenceCount: header.sequenceCount,
    sequences: header.sequences
  };
}


/**
 * Read 2-bit encoded base pairs from a DataView into an array of 'A', 'T',
 * 'C', 'G' strings.
 * These are returned as an array (rather than a string) to facilitate further
 * modification.
 */
function unpackDNA(dataView: DataView, startBasePair: number, numBasePairs: number): Array<string> {
  // TODO: use jBinary bitfield for this
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


/**
 * An umbrella error type to describe issues with parsing an
 * incomplete chunk of data with JBinary's read. If this is being
 * raised, we either need to ask for more data (a bigger chunk) or
 * report to the user that there might be a problem with the 2bit
 * file, specifically with its header.
 */
function IncompleteChunkError(message) {
    this.name = "IncompleteChunkError";
    this.message = (message || "");
}
IncompleteChunkError.prototype = Error.prototype;

/**
 * Wraps a parsing attempt, captures errors related to
 * incomplete data and re-throws a specialized error:
 * IncompleteChunkError. Otherwise, whatever other error
 * is being raised gets escalated.
 */
function parseWithException(parseFunc: Function) {
  try {
    return parseFunc();
  } catch(error) {
    // Chrome-like browsers: RangeError; phantomjs: DOMException
    if (error.name == "RangeError" || error.name == "INDEX_SIZE_ERR") {
        console.log(`Error name: ${error.name}`);
        throw new IncompleteChunkError(error);
    } else {
      throw error;
    }
  }
}

/**
 * Try getting a bigger chunk of the remote file
 * until the Incomplete Chunk Error is resolved. This is useful when we need to
 * parse the header, but when we don't know the size of the header up front.
 * If the intial request returns an incomplete header and hence the
 * parsing fails, we next try doubling the requested size.
 * The size of the request is capped with `untilSize` so that
 * we don't start asking for MBs of data for no use.
 * Instead we we throw an error if we reach the cap,
 * potentially meaning a corrupted 2bit file.
*/
function retryRemoteGet(remoteFile: RemoteFile, start: number, size: number, untilSize: number, promisedFunc: Function) {
  return remoteFile.getBytes(start, size).then(promisedFunc).catch(error => {
    if(error.name == "IncompleteChunkError") {
      // Do not attempt to download more than `untilSize`
      if(size > untilSize) {
        throw `Couldn't parse the header ` +
              `from the first ${size} bytes of the file. ` +
              `Corrupted 2bit file?`;
      }
      return retryRemoteGet(remoteFile, start, size*2, untilSize, promisedFunc);
    } else {
      throw error;
    }
  });
}

class TwoBit {
  remoteFile: RemoteFile;
  header: Q.Promise<TwoBitHeader>;

  constructor(remoteFile: RemoteFile) {
    this.remoteFile = remoteFile;
    var deferredHeader = Q.defer();
    this.header = deferredHeader.promise;
    retryRemoteGet(
      this.remoteFile,
      0,  // Beginning of the file
      FIRST_HEADER_CHUNKSIZE,
      MAX_CHUNKSIZE,
      buffer => {
        var header = parseWithException(() => {
          return parseHeader(buffer);
        });
        deferredHeader.resolve(header);
      }).done();
  }

  /**
   * Returns the base pairs for contig:start-stop.
   * The range is inclusive and zero-based.
   * Returns empty string if no data is available on this range.
   */
  getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<string> {
    if (start > stop) {
      throw `Requested a 2bit range with start > stop (${start}, ${stop})`;
    }

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
      if (maybeSeq === null || maybeSeq === undefined) {
        throw 'Invalid contig: ' + contig + 'in TwoBit';
      }
      var seq = maybeSeq;  // for flow, see facebook/flow#266

      return retryRemoteGet(
        this.remoteFile,
        seq.offset,
        FIRST_SEQUENCE_CHUNKSIZE,
        MAX_CHUNKSIZE,
        buffer => {
          return parseWithException(() => {
            return parseSequenceRecord(buffer, seq.offset);
          });
        }
      );
    });
  }
}

module.exports = TwoBit;
