/**
 * Parser for bigWig format.
 * Based on UCSC's src/inc/bbiFile.h
 * @flow
 */
'use strict';

import Q from 'q';
import _ from 'underscore';
import jBinary from 'jbinary';

import RemoteFile from '../RemoteFile';
import ContigInterval from '../ContigInterval';
import bbi from './formats/bbi';
import ImmediateBigWig from './ImmediateBigWig';
import BigBedWig from './BigBedWig';

type WigBlock = {
  chrId: string;
  start: number;
  end: number;
  step: number;
  span: number;
  tpe: number;
  count: number;
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
    // this.remoteFile = new RemoteFile(url);
    // this.header = this.remoteFile.getBytes(0, 64*1024).then(parseHeader);
    // this.contigMap = this.header.then(generateContigMap);
    //
    // // Next: fetch the block index and parse out the "CIR" tree.
    // this.cirTree = this.header.then(header => {
    //   // zoomHeaders[0].dataOffset is the next entry in the file.
    //   // We assume the "cirTree" section goes all the way to that point.
    //   // Lacking zoom headers, assume it's 4k.
    //   // TODO: fetch more than 4k if necessary
    //   var start = header.unzoomedIndexOffset,
    //     zoomHeader = header.zoomHeaders[0],
    //     length = zoomHeader ? zoomHeader.dataOffset - start : 4096;
    //   return this.remoteFile.getBytes(start, length).then(parseCirTree);
    // });

    super(url);
    
    this.immediate = Q.all([this.header, this.cirTree, this.contigMap])
      .then(([header, cirTree, contigMap]) => {
        var cm: {[key:string]: number} = contigMap;
        return new ImmediateBigBed(this.remoteFile, header, cirTree, cm);
      });

    // Bubble up errors
    this.immediate.done();
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
  getFeatureBlocksOverlapping(range: ContigInterval<string>): Q.Promise<Array<WigBlock>> {
    return this.immediate.then(im => im.getFeatureBlocksOverlapping(range));
  }
}

module.exports = BigBed;
