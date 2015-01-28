/// <reference path="typings/q/q.d.ts" />
/// <reference path="xhr.ts" />

interface DataSource {
  fetchRange(contig: string, start: number, stop: number): void;
  getFeaturesInRange(contig: string, start: number, stop: number): Array<any>;
}

interface FileIndexEntry {
  name: string;
  offset: number;
}

interface TwoBitHeader {
  sequenceCount: number;
  reserved: number;
  sequences: FileIndexEntry[];
}


var TWO_BIT_MAGIC = 0x1A412743;


/**
 * Extract a sequence of ASCII characters from an ArrayBuffer as a string.
 * This throws if any non-ASCII characters are encountered.
 */
function extractAsciiFromBuffer(buffer: ArrayBuffer, offset: number, length: number): string {
  var u8 = new Uint8Array(buffer, offset, length);
  var result = '';
  for (var i = 0; i < length; i++) {
    var c = u8[i];
    if (c > 127) {
      throw 'Encountered non-ASCII character ' + c;
    }
    result += String.fromCharCode(c);
  }
  return result;
}

/**
 * This function is helpful because Uint32Array has to be 4-byte aligned.
 */
function extractUint32FromArrayBuffer(buffer: ArrayBuffer, offset: number): number {
  var u8 = new Uint8Array(buffer, offset);
  return u8[0] * (1 << 24) + u8[1] * (1 << 16) + u8[2] * (1 << 8) + u8[3];
}


function parseHeader(buffer: ArrayBuffer): TwoBitHeader {
  var u32 = new Uint32Array(buffer),
      u8 = new Uint8Array(buffer);
  var magic = u32[0];
  if (magic != TWO_BIT_MAGIC) {
    throw 'Invalid magic';
  }
  var version = u32[1];
  if (version != 0) {
    throw 'Unknown version of 2bit';
  }
  var sequenceCount = u32[2],
      reserved = u32[3];

  var byteOffset = 16;
  var sequences: FileIndexEntry[] = [];
  for (var i = 0; i < sequenceCount; i++) {
    var nameSize = u8[byteOffset];
    byteOffset += 1;
    var name = extractAsciiFromBuffer(buffer, byteOffset, nameSize);
    byteOffset += nameSize;
    var offset = extractUint32FromArrayBuffer(buffer, byteOffset);
    byteOffset += 4;
    sequences.push({name, offset});
  }
  // hg19 header is 1671 bytes

  return {
    sequenceCount,
    reserved,
    sequences
  };
}


class TwoBit implements DataSource {
  constructor(private url: string) {
    fetchByteRange(url, 0, 4095).then(function(response) {
        var header = parseHeader(response.buffer);
        console.log(header);
      }).catch(function(e) {
        console.error(e);
      });
  }

  fetchRange(contig: string, start: number, stop: number): void {
  //  var promise = Qajax(this.url)
  //      .then(Qajax.filterSuccess)
  //      .get("responseText")  // using a cool Q feature here
  //      .then(function (txt) {
  //        console.log("server returned: ", txt);
  //      }, function (err) {
  //        console.log("xhr failure: ", err);
  //      });
  }

  getFeaturesInRange(contig: string, start: number, stop: number): Array<Object> {
    return [];
  }
}
