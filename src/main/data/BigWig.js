/**
 * Parser for bigWig format.
 * Based on UCSC's src/inc/bbiFile.h
 * @flow
 */
'use strict';

import Q from 'q';

import ContigInterval from '../ContigInterval';
import BigBedWig from './BigBedWig';
import bbi from './formats/bbi';

export type Bucket = {
  chrId: string;
  start: number;
  end: number;
  value: number;
}

class BigWig extends BigBedWig {
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
    return bbi.TYPE_SET(false);
  }

  /**
   * Returns all features in blocks overlapping the given range.
   * Because these features must all be fetched, decompressed and parsed
   * anyway, this can be helpful for upstream caching.
   */
  // getFeatureBlocksOverlapping(range: ContigInterval<string>): Q.Promise<Array<WigBlock>> {
  //   return this.immediate.then(im => im.getFeatureBlocksOverlapping(range));
  // }
  
  getBuckets(range: ContigInterval<string>, numBuckets: number): Q.Promise<Array<Bucket>> {
    return this.immediate.then(im => im.getBuckets(range, numBuckets));
  }
}

module.exports.BigWig = BigWig;
