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
import {ChromTree, RTree, RTreeNode} from './formats/bbi';

// Generate the reverse map from contig ID --> contig name.
function reverseContigMap(contigMap: {[key:string]: number}): Array<string> {
  var ary = [];
  _.each(contigMap, (index, name) => {
    ary[index] = name;
  });
  return ary;
}

function denormalizeRTreeChildren(remoteFile, node, branchingFactor) {
  if (!node.isLeaf) {
    var childPointers = node.childPointers;
    var childrenStart = childPointers[0].offset;
    var lastChildLength = Math.max(64 * 1024, (branchingFactor * 32 + 4) * childPointers.length);
    var childrenEnd = childrenStart + lastChildLength;
    //console.log("parsing non-leaf node: %O, children: [%O,%O) (%O)", node, childrenStart, childrenEnd, lastChildLength);
    return remoteFile.getSize()
      .then(size => Math.min(size - 1, childrenEnd) - childrenStart)
      .then(length => remoteFile.getBytes(childrenStart, length))
      .then(childrenBuf => new jBinary(childrenBuf, { 'jBinary.littleEndian': true, 'node': RTreeNode }))
      .then(jb =>
        Q.all(
          childPointers.map(childPointer => {
            jb.seek(childPointer.offset - childrenStart);
            return denormalizeRTreeChildren(remoteFile, jb.read('node'), branchingFactor);
          })
        )
      )
      .then(parsedChildren => {
        node.children = parsedChildren;
        // console.log("processed non-leaf node:", node);
        return node;
      });
  } else {
    node.dataPointers = node.childPointers;
    delete node.childPointers;
    // console.log("processed leaf node:", node);
    return Q.when(node);
  }
}

function parseRTree(remoteFile, start, end) {
  // TODO: fetch more than 64k if necessary
  end = end || (start + 64 * 1024);
  return remoteFile
    .getBytes(start, end - start)
    .then(buf => {
      return parse(buf, RTree);
    })
    .then(rTree => {
      return denormalizeRTreeChildren(remoteFile, rTree.root, rTree.branchingFactor)
        .then(root => {
          return rTree;
        });
    });
}

function parse(buffer, type_set, key) {
  if (!type_set) throw new Error("bad type_set: " + type_set);
  if (!key) {
    type_set = { 'jBinary.littleEndian': true, t: type_set };
    key = 't';
  }
  return new jBinary(buffer, type_set).read(key);
}

class BigBedWig {
  remoteFile: RemoteFile;
  header: Object;
  index: Object;
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
          var childPointers = chromTree.root.childPointers;
          if (!childPointers) {
            throw 'Invalid chromosome tree';
          }

          return _.object(childPointers.map(function({id, key}) {
            // remove trailing nulls from the key string
            return [ key.replace(/\0.*/, ''), id ];
          }));
        });
      });

    // Next: fetch the block index and parse out the R-tree index.
    var index = header.then(header => parseRTree(remoteFile, header.unzoomedIndexOffset));

    var immediate = Q.all([ header, index, contigMap ]);

    // Bubble up errors.
    immediate.done();

    return { remoteFile, immediate };
  }

  constructor(remoteFile, header, index, contigMap: {[key:string]: number}) {
    if (!header) {
      throw new Error("empty BigBed/Wig header; did you try to instantiate it directly instead of using .load()?");
    }
    this.remoteFile = remoteFile;
    this.header = header;
    this.index = index;
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
  parse,
  parseRTree
};
