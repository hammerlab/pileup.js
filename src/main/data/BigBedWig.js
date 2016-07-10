/**
 * Common functionality for parsing BigBed and BigWig files.
 * Based on UCSC's src/inc/bbiFile.h
 * @flow
 */
'use strict';

import Q from 'q';
import _ from 'underscore';
import jBinary from 'jbinary';

import LocalFile from '../LocalFile';
import ImmediateBigBed from './ImmediateBigBed';
import RemoteFile from '../RemoteFile';
import ContigInterval from '../ContigInterval';
import bbi from './formats/bbi';
import ImmediateBigBedWig from './ImmediateBigBedWig';
import urlUtils from 'url';

function parseHeader(buffer) {
  // TODO: check Endianness using magic. Possibly use jDataView.littleEndian
  // to flip the endianness for jBinary consumption.
  // NB: dalliance doesn't support big endian formats.
  return new jBinary(buffer, bbi.TYPE_SET).read('Header');
}

// The "CIR" tree contains a mapping from sequence -> block offsets.
// It stands for "Chromosome Index R tree"
function parseCirTree(buffer) {
  return new jBinary(buffer, bbi.TYPE_SET).read('CirTree');
}

// Extract a map from contig name --> contig ID from the bigBed header.
function generateContigMap(header): {[key:string]: number} {
  // Just assume it's a flat "tree" for now.
  var nodes = header.chromosomeTree.nodes.contents;
  if (!nodes) {
    throw 'Invalid chromosome tree';
  }
  return _.object(nodes.map(function({id, key}) {
    // remove trailing nulls from the key string
    return [key.replace(/\0.*/, ''), id];
  }));
}

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

class BigBedWig<I: ImmediateBigBedWig> {
  remoteFile: RemoteFile;
  header: Q.Promise<any>;
  cirTree: Q.Promise<any>;
  contigMap: Q.Promise<{[key:string]: number}>;
  immediate: Q.Promise<I>;
  zoomIndices: Q.Promise<Array<any>>;

  /**
   * Prepare to request features from a remote bigBed file.
   * The remote source must support HTTP Range headers.
   * This will kick off several async requests for portions of the file.
   */
  constructor(url: string) {

    // var parsedUrl = urlUtils.parse(url);
    // if (parsedUrl.protocol && parsedUrl.protocol != 'file') {
      this.remoteFile = new RemoteFile(url);
    // } else {
    //   this.remoteFile = new LocalFile(url);
    // }

    this.header = this.remoteFile.getBytes(0, 64*1024).then(parseHeader);
    this.contigMap = this.header.then(generateContigMap);

    // Next: fetch the block index and parse out the "CIR" tree.
    this.cirTree = this.header.then(header => {
      // zoomHeaders[0].dataOffset is the next entry in the file.
      // We assume the "cirTree" section goes all the way to that point.
      // Lacking zoom headers, assume it's 4k.
      // TODO: fetch more than 4k if necessary
      var start = header.unzoomedIndexOffset,
        zoomHeader = header.zoomHeaders[0],
        length = zoomHeader ? zoomHeader.dataOffset - start : 4096;
      return this.remoteFile.getBytes(start, length).then(parseCirTree);
    });

    this.zoomIndices =
      this.header.then(header => {
        header.zoomHeaders.map((zoomHeader, idx) => {
          var byteRangeStart = zoomHeader.indexOffset;
          var byteRangeEnd = 
            (idx + 1 < header.zoomLevels.length) ? 
              header.zoomLevels[idx + 1].dataOffset :
              this.remoteFile.getSize()
            ;
          
          return this.remoteFile.getBytes(byteRangeStart, byteRangeEnd - byteRangeStart)
        });
      });

    this.immediate = Q.all([this.header, this.cirTree, this.contigMap, this.zoomIndices])
      .then(([header, cirTree, contigMap, zoomIndices]) => {
        var cm: {[key:string]: number} = contigMap;
        return new ImmediateBigBed(this.remoteFile, header, cirTree, cm, zoomIndices);
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
  // getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<Array<BedRow>> {
  //   var range = new ContigInterval(contig, start, stop);
  //   return this.immediate.then(im => im.getFeaturesInRange(range));
  // }

  /**
   * Returns all features in blocks overlapping the given range.
   * Because these features must all be fetched, decompressed and parsed
   * anyway, this can be helpful for upstream caching.
   */
  // getFeatureBlocksOverlapping(range: ContigInterval<string>): Q.Promise<Array<BedBlock>> {
  //   return this.immediate.then(im => im.getFeatureBlocksOverlapping(range));
  // }
}

//module.exports = {BigBed, parseHeader, parseCirTree};
module.exports = BigBedWig;
