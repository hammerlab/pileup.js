/// <reference path="typings/q/q.d.ts" />
/// <reference path="typings/underscore/underscore.d.ts" />
/// <reference path="readableview.ts" />
/// <reference path="remotefile.ts" />

interface DataSource {
  getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<any>;
}

enum BaseMask { Intron, Exon, Unknown };

interface BasePair {
  base: string;  // A, T, C, G or N (unknown)
}

interface FileIndexEntry {
  name: string;
  offset: number;
}

interface SequenceRecord {
  numBases: number;
  unknownBlockStarts: number[];
  unknownBlockLengths: number[];
  numMaskBlocks: number
  maskBlockStarts: number[];
  maskBlockLengths: number[];
  dnaOffsetInFile: number;
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
    dnaOffsetInFile: offset
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


class TwoBit implements DataSource {
  remoteFile: RemoteFile;
  header: Q.Promise<TwoBitHeader>;
  constructor(private url: string) {
    this.remoteFile = new RemoteFile(url);
    var deferredHeader = Q.defer<TwoBitHeader>();
    this.header = deferredHeader.promise;

    this.remoteFile.getBytes(0, 4096).then(function(dataView) {
        var header = parseHeader(dataView);
        deferredHeader.resolve(header);
      }).catch(function(e) {
        console.error(e);
      });
  }

  getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<string> {
    return this.header.then(header => {
      var seq = _.findWhere(header.sequences, {contig});
      if (!seq) {
        throw 'Invalid contig: ' + contig;
      }

      return this.remoteFile.getBytes(seq.offset, seq.offset + 4095).then(seqHeaderView => {
        var seqHeader = parseSequenceRecord(seqHeaderView);
        console.log(seqHeader);
        return 'ABCD';
      });
    });
  }
}
