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
import {ChromTree, CirTree} from './formats/bbi';

// Generate the reverse map from contig ID --> contig name.
function reverseContigMap(contigMap: {[key:string]: number}): Array<string> {
  var ary = [];
  _.each(contigMap, (index, name) => {
    ary[index] = name;
  });
  return ary;
}

function parse(buffer, type_set, key) {
  if (!key) {
    type_set = { 'jBinary.littleEndian': true, t: type_set };
    key = 't';
  }
  return new jBinary(buffer, type_set).read(key);
}

class BigBedWig {
  remoteFile: RemoteFile;
  header: Object;
  cirTree: Object;
  contigMap: {[key:string]: number};
  chrIdToContig: string[];
  isCompressed: boolean;
  blockCache: map<number, Object>;

  static load(url: string, header_format) {
    var remoteFile = new RemoteFile(url);

    var header =
      remoteFile.getBytes(0, 64*1024).then(buffer => {
        // TODO: check Endianness using magic.
        // NB: dalliance doesn't support big endian formats.
        return parse(buffer, header_format);
      });

    var contigMap =
      header.then(header => {
        return remoteFile.getBytes(header.chromosomeTreeOffset, 4096).then(buffer => {
          var chromTree = parse(buffer, ChromTree);

          // Just assume it's a flat "tree" for now.
          var nodes = chromTree.root.contents;
          if (!nodes) {
            throw 'Invalid chromosome tree';
          }

          return _.object(nodes.map(function({id, key}) {
            // remove trailing nulls from the key string
            return [key.replace(/\0.*/, ''), id];
          }));
        });
      });

    // Next: fetch the block index and parse out the "CIR" tree.
    var cirTree = header.then(header => {
      // TODO: fetch more than 4k if necessary
      var start = header.unzoomedIndexOffset,
        length = 4096;

      return remoteFile.getBytes(start, length).then(buffer => {
        return parse(buffer, CirTree, 'CirTree');
      });
    });

    var immediate = Q.all([ header, cirTree, contigMap ]);

    // Bubble up errors.
    immediate.done();

    return { remoteFile, immediate };
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

module.exports = {
  BigBedWig,
  parse
};
