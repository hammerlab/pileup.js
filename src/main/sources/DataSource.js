/**
 * Holds abstract code that can be shared by multiple data sources.
 * @flow
 */

import type {GenomeRange} from '../types';
import type ContigInterval from '../ContigInterval';

import type {Alignment} from '../Alignment';
import Chromosome from '../data/chromosome';
import Feature from '../data/feature';
import Gene from '../data/gene';

// Flow type for export.
export type DataSource<T: ( Gene | Feature | Alignment | Chromosome)> = {
  rangeChanged: (newRange: GenomeRange) => void;
  getFeaturesInRange: (range: ContigInterval<string>, resolution: ?number) => T[];
  on: (event: string, handler: Function) => void;
  once: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
}
