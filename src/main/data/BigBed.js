/**
 * Parser for bigBed format.
 * Based on UCSC's src/inc/bbiFile.h
 * @flow
 */
'use strict';

import Q from 'q';

import ImmediateBigBed from './ImmediateBigBed';
import ContigInterval from '../ContigInterval';
import BigBedWig from './BigBedWig';
import bbi from './formats/bbi';

type BedRow = {
  // Half-open interval for the BED row.
  contig: string;
  start: number;
  stop: number;
  // Remaining fields in the BED row (typically tab-delimited)
  rest: string;
}

// All features found in range.
type BedBlock = {
  range: ContigInterval<string>;
  rows: BedRow[];
}

class BigBed extends BigBedWig {
  // remoteFile: RemoteFile;
  // header: Q.Promise<any>;
  // cirTree: Q.Promise<any>;
  // contigMap: Q.Promise<{[key:string]: number}>;
  // immediate: Q.Promise<ImmediateBigBed>;

  /**
   * Prepare to request features from a remote bigBed file.
   * The remote source must support HTTP Range headers.
   * This will kick off several async requests for portions of the file.
   */
  constructor(url: string) {
    super(url);

    this.immediate = Q.all([this.header, this.cirTree, this.contigMap])
        .then(([header, cirTree, contigMap]) => {
          var cm: {[key:string]: number} = contigMap;
          return new ImmediateBigBed(this.remoteFile, header, cirTree, cm);
        });

    // Bubble up errors
    this.immediate.done();
  }

  typeSet() {
    return bbi.TYPE_SET(true);
  }
  
  /**
   * Returns all BED entries which overlap the range.
   * Note: while the requested range is inclusive on both ends, ranges in
   * bigBed format files are half-open (inclusive at the start, exclusive at
   * the end).
   */
  getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<Array<BedRow>> {
    var range = new ContigInterval(contig, start, stop);
    return this.immediate.then(im => im.getFeaturesInRange(range));
  }

  /**
   * Returns all features in blocks overlapping the given range.
   * Because these features must all be fetched, decompressed and parsed
   * anyway, this can be helpful for upstream caching.
   */
  getFeatureBlocksOverlapping(range: ContigInterval<string>): Q.Promise<Array<BedBlock>> {
    return this.immediate.then(im => im.getFeatureBlocksOverlapping(range));
  }
}

module.exports = BigBed;
