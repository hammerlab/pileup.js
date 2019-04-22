/**
 * Interface for alignments, shared between BAM and GA4GH backends.
 * @flow
 */
'use strict';
 
import type {GenomeRange} from './types';
import type ContigInterval from './ContigInterval';
import type {CoverageCount} from './viz/pileuputils';

// "CIGAR" operations express how a sequence aligns to the reference: does it
// have insertions? deletions? For more background, see the SAM/BAM paper.
export type CigarSymbol = 'M'|'I'|'D'|'N'|'S'|'H'|'P'|'='|'X';
export type CigarOp = {
  op: CigarSymbol;
  length: number
}

// converts a string into a Strand element. Must be '+' or '-'. Any other
// strings will be converted to '.'.
function strToStrand(str: string): Strand {
  return str && str == '+' ? '+' : (str && str == '-' ? '-' : '.'); // either +, - or .
}

export type Strand = '-' | '+' | '.';

// converts a GA4GH Strand to a string of  ga4gh.Common.strand.POS_STRAND,
// NEG_STRAND, or STRAND_UNSPECIFIED to Strand type.
function ga4ghStrandToStrand(str: string): Strand {
  return str && str == 'POS_STRAND' ? '+' : (str && str == 'NEG_STRAND' ? '-' : '.'); // either +, - or .
}

export type MateProperties = {
  ref: ?string;
  pos: number;
  strand: Strand;
}

export type Alignment = {
  pos: number;
  ref: string;
  name: string;
  cigarOps: CigarOp[];

  getKey(): string;
  getStrand(): Strand;
  getQualityScores(): number[];
  getSequence(): string;
  getInterval(): ContigInterval<string>;
  intersects(interval: ContigInterval<string>): boolean;
  getReferenceLength(): number;
  getMateProperties(): ?MateProperties;
  getInferredInsertSize(): number;
  getCoverage(referenceSource: Object): CoverageCount;
  debugString(): string;
};

module.exports = {
  strToStrand,
  ga4ghStrandToStrand
};
