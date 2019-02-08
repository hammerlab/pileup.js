/**
 * Interface for alignments, shared between BAM and GA4GH backends.
 * @flow
 */
'use strict';
 
import type {GenomeRange} from './types';
import type ContigInterval from './ContigInterval';

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
};

export type AlignmentDataSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  getFeaturesInRange: (range: ContigInterval<string>) => Alignment[];
  on: (event: string, handler: Function) => void;  // really => AlignmentDataSource
  once: (event: string, handler: Function) => void;
  off: (event: string) => void;
};

module.exports = {
  strToStrand
};
