/**
 * Common functionality for parsing BigBed and BigWig files.
 * Based on UCSC's src/inc/bbiFile.h
 * @flow
 */
'use strict';

import Q from 'q';
import _ from 'underscore';
import jBinary from 'jbinary';

import RemoteFile from '../RemoteFile';
import ContigInterval from '../ContigInterval';
import {CirTree} from './formats/bbi';

// Generate the reverse map from contig ID --> contig name.
function reverseContigMap(contigMap: {[key:string]: number}): Array<string> {
  var ary = [];
  _.each(contigMap, (index, name) => {
    ary[index] = name;
  });
  return ary;
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

class BigBedWig {
  remoteFile: RemoteFile;
  header: Object;
  cirTree: Object;
  contigMap: {[key:string]: number};
  chrIdToContig: string[];
  isCompressed: boolean;
  blockCache: map<number, Object>;

  static load(url: string, type_set) {
    this.remoteFile = new RemoteFile(url);

    this.header = this.remoteFile.getBytes(0, 64*1024).then(buffer => {
      // TODO: check Endianness using magic. Possibly use jDataView.littleEndian
      // to flip the endianness for jBinary consumption.
      // NB: dalliance doesn't support big endian formats.
      return new jBinary(buffer, type_set).read('Header');
    });

    this.contigMap = this.header.then(generateContigMap);

    // Next: fetch the block index and parse out the "CIR" tree.
    this.cirTree = this.header.then(header => {
      // zoomHeaders[0].dataOffset is the next entry in the file.
      // We assume the "cirTree" section goes all the way to that point.
      // Lacking zoom headers, assume it's 4k.
      // TODO: fetch more than 4k if necessary
      var start = header.unzoomedIndexOffset,
        zoomHeader = header.zoomHeaders && header.zoomHeaders[0],
        length = zoomHeader ? zoomHeader.dataOffset - start : 4096;

      return this.remoteFile.getBytes(start, length).then(buffer => {
        return new jBinary(buffer, CirTree).read('CirTree');
      });
    });

    var immediate = Q.all([ Q.when(this.remoteFile), this.header, this.cirTree, this.contigMap ]);

    // Bubble up errors
    immediate.done();

    return immediate;
  }

  constructor(remoteFile, header, cirTree, contigMap: {[key:string]: number}) {
    if (!header) {
      throw new Error("empty BigBed/Wig header; did you try to instantiate it directly instead of using .load()?")
    }
    this.remoteFile = remoteFile;
    this.header = header;
    this.cirTree = cirTree;
    this.contigMap = contigMap;
    this.chrIdToContig = reverseContigMap(contigMap);
    this.isCompressed = (this.header.uncompressBufSize > 0);
    this.blockCache = {};
  }

  // Map contig name to contig ID. Leading "chr" is optional. Throws on failure.
  _getContigId(contig: string): number {
    if (contig in this.contigMap) return this.contigMap[contig];
    var chr = 'chr' + contig;
    if (chr in this.contigMap) return this.contigMap[chr];
    throw `Invalid contig ${contig}`;
  }

  _getChrIdInterval(range: ContigInterval<string>): ContigInterval<number> {
    return new ContigInterval(
      this._getContigId(range.contig), range.start(), range.stop());
  }

  _getContigInterval(range: ContigInterval<number>): ContigInterval<string> {
    return new ContigInterval(
      this.chrIdToContig[range.contig], range.start(), range.stop());
  }

  // Bed entries have a chromosome ID. This converts that to a contig string.
  _attachContigToBedRows(beds: ChrIdBedRow[]): BedRow[] {
    return beds.map(bed => ({
      contig: this.chrIdToContig[bed.chrId],
      start: bed.start,
      stop: bed.stop,
      rest: bed.rest
    }));
  }
}

module.exports = BigBedWig;
