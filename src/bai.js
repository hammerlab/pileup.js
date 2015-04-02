/**
 * Tools for working with indexed BAM (BAI) files.
 * These have nothing to say about parsing the BAM file itself. For that, see
 * bam.js.
 * @flow
 */

import type * as RemoteFile from './RemoteFile';
import type * as ContigInterval from './ContigInterval';
import type * as Q from 'q';

var bamTypes = require('./formats/bamTypes');
var jBinary = require('jbinary');
var jDataView = require('jdataview');
var Interval = require('./Interval');
var _ = require('underscore');

/*

General notes about BAI format:
- It's a multi-level index: each particular locus is covered by several "bins" of different sizes.
- It's an index of ranges (the reads). Each range gets places in the smallest bucket which contains it. So while most reads will be in small bins, it's still necessary to look in the large bins for reads which might cross smaller bin boundaries.

In the BAI format, each bin spans either:
- 512Mbp (bin 0)
- 64Mbp  (bins 1-8)
- 8Mbp   (bins 9-72)
- 1Mbp   (bins 73-584)
- 128kbp (bins 585-4680)
- 16kbp  (bins 4681-37448)

The BAI file stores the file start/stop offsets for each bin.
It *also* stores a linear index, which can be used to avoid lookups in larger bins.
*/


// TODO: add support for index chunks
// time for 'blob': 6.886s with console open
// time for 'lazyArray': 9s with console open (3.855 closed)

class BaiFile {
  remoteFile: RemoteFile;
  index: Q.Promise<Object>;

  constructor(remoteFile: RemoteFile) {
    this.remoteFile = remoteFile;
    this.index = remoteFile.getAll().then(buf => {
    // this.index = remoteFile.getBytes(0, 712304).then(buf => {
      var start = new Date().getTime();
      var o = new jBinary(buf, bamTypes.TYPE_SET).read('BaiFile');
      // var view = new jDataView(buf);
      // view.readInt32();  // magic
      // var n_ref = view.readInt32();
      // var n_bin = view.readInt32();
      // for (var i = 0; i < n_bin; i++) {

      // }
      // var n_intv = view.readInt32();
      // for (var i = 0; i < n_intv; i++) {

      // }

      var stop = new Date().getTime();
      console.log('parse time: ', (stop - start) / 1000);
      return o;
    });
    
    this.index.done();
  }

  getChunksForInterval(range: ContigInterval<number>): Q.Promise<Interval[]> {
    return this.index.then(index => {
      console.log(index);
      if (range.contig < 0 || range.contig > index.n_ref) {
        throw `Invalid contig ${range.contig}`;
      }

      var bins = reg2bins(range.start(), range.stop() + 1);

      var contigIndex = index.indices[range.contig];
      var chunks = _.chain(contigIndex.bins)
                    .filter(b => bins.indexOf(b.bin) >= 0)
                    .map(b => b.chunks)
                    .flatten()
                    .uniq(false /* not sorted */,
                          c => c.chunk_beg + ',' + c.chunk_end)
                    .value();
      return chunks;
    });
  }
}


// These functions come directly from the SAM paper
// See https://samtools.github.io/hts-specs/SAMv1.pdf section 5.3

// calculate bin given an alignment covering [beg,end)
// (zero-based, half-closed-half-open)
function reg2bin(beg, end) {
  --end;
  if (beg>>14 == end>>14) return ((1<<15)-1)/7 + (beg>>14);
  if (beg>>17 == end>>17) return ((1<<12)-1)/7 + (beg>>17);
  if (beg>>20 == end>>20) return ((1<<9)-1)/7  + (beg>>20);
  if (beg>>23 == end>>23) return ((1<<6)-1)/7  + (beg>>23);
  if (beg>>26 == end>>26) return ((1<<3)-1)/7  + (beg>>26);
  return 0;
}

// calculate the list of bins that may overlap with region [beg,end) (zero-based)
function reg2bins(beg, end) {
  var i = 0, k, list = [];
  --end;
  list.push(0);
  for (k =    1 + (beg>>26); k <=    1 + (end>>26); ++k) list.push(k);
  for (k =    9 + (beg>>23); k <=    9 + (end>>23); ++k) list.push(k);
  for (k =   73 + (beg>>20); k <=   73 + (end>>20); ++k) list.push(k);
  for (k =  585 + (beg>>17); k <=  585 + (end>>17); ++k) list.push(k);
  for (k = 4681 + (beg>>14); k <= 4681 + (end>>14); ++k) list.push(k);
  return list;
}

module.exports = BaiFile;
