/**
 * This serves as a bridge between org.ga4gh.GAReadAlignment and the
 * pileup.js Alignment type.
 * @flow
 */
'use strict';

import type {CigarOp, MateProperties, Strand} from './Alignment';

import ContigInterval from './ContigInterval';
import SamRead from './data/SamRead';

// See https://github.com/ga4gh/ga4gh-schemas/blob/master/src/main/proto/ga4gh/reads.proto
// Data can be queried at http://1kg.ga4gh.org/reads/search
var OP_MAP = {
  ALIGNMENT_MATCH: 'M',
  INSERT: 'I',
  DELETE: 'D',
  SKIP: 'N',
  CLIP_SOFT: 'S',
  CLIP_HARD: 'H',
  PAD: 'P',
  SEQUENCE_MATCH: '=',
  SEQUENCE_MISMATCH: 'X'
};

/**
 * This class acts as a bridge between org.ga4gh.GAReadAlignment and the
 * pileup.js Alignment type.
 */
class GA4GHAlignment /* implements Alignment */ {
  pos: number;
  ref: string;
  alignment: Object;
  name: string;
  cigarOps: CigarOp[];
  _interval: ContigInterval<string>;

  // alignment follows org.ga4gh.GAReadAlignment
  // https://github.com/ga4gh/ga4gh-schemas/blob/master/src/main/proto/ga4gh/reads.proto
  constructor(alignment: Object) {
    this.alignment = alignment;
    this.pos = parseInt(alignment.alignment.position.position);
    this.ref = alignment.alignment.position.referenceName;
    this.name = alignment.fragmentName;

    this.cigarOps = alignment.alignment.cigar.map(
        ({operation, operationLength: length}) => ({ op: OP_MAP[operation], length: parseInt(length)})
    );
    this._interval = new ContigInterval(this.ref,
                                        this.pos,
                                        this.pos + this.getReferenceLength() - 1);
  }

  getKey(): string {
    return GA4GHAlignment.keyFromGA4GHResponse(this.alignment);
  }

  getStrand(): Strand {
    return this.alignment.alignment.position.strand == 'NEG_STRAND' ? '-' : '+';
  }

  getQualityScores(): number[] {
    return this.alignment.alignedQuality;
  }

  getSequence(): string {
    return this.alignment.alignedSequence;
  }

  getInterval(): ContigInterval<string> {
    return this._interval;
  }

  intersects(interval: ContigInterval<string>): boolean {
    return interval.intersects(this.getInterval());
  }

  getReferenceLength(): number {
    return SamRead.referenceLengthFromOps(this.cigarOps);
  }

  getMateProperties(): ?MateProperties {
    var next = this.alignment.nextMatePosition;
    return next && {
      ref: next.referenceName,
      pos: parseInt(next.position),
      strand: next.strand == 'NEG_STRAND' ? '-' : '+'
    };
  }

  getInferredInsertSize(): number {
    // TODO: SAM/BAM writes this explicitly. Does GA4GH really not?
    var m = this.getMateProperties();
    if (m && m.ref == this.ref) {
      var start1 = this._interval.start(),
          stop1 = this._interval.stop(),
          start2 = m.pos,
          stop2 = start2 + this.getSequence().length;
      return Math.max(stop1, stop2) - Math.min(start1, start2);
    } else {
      return 0;
    }
  }

  // This is exposed as a static method to facilitate an optimization in GA4GHAlignmentSource.
  static keyFromGA4GHResponse(alignment: Object): string {
    // this.alignment.id would be appealing here, but it's not actually unique!
    return alignment.fragmentName + ':' + alignment.readNumber;
  }
}

module.exports = GA4GHAlignment;
