/**
 * Class for parsing chromosome bands for idiograms.
 * Format taken from https://github.com/hammerlab/idiogrammatik.
 * @flow
 */
'use strict';

import ContigInterval from '../ContigInterval';
import type {CoverageCount} from '../viz/pileuputils';
import _ from 'underscore';

// chromosomal band (see https://github.com/hammerlab/idiogrammatik/blob/master/data/basic-chromosomes.json)
// for an example
export type Band = {
  start: number;
  end:  number;
  name: string;
  value: string;
}

class Chromosome {
  name: string;
  bands: Band[];
  position: ContigInterval<string>;

  constructor(chromosome: Object) {
    this.name = chromosome.name;
    this.bands = chromosome.bands;
    // create region for chromosome
    var start = _.min(this.bands, band => band.start).start;


    var stop =  _.max(this.bands, band => band.end).end;
    this.position = new ContigInterval(this.name, start, stop);
  }

  getKey(): string {
    return this.name;
  }

  getInterval(): ContigInterval<string> {
    return this.position;
  }

  getCoverage(referenceSource: Object): CoverageCount {
    return {
      range: this.getInterval(),
      opInfo: null
    };
  }

  intersects(range: ContigInterval<string>): boolean {
    return range.intersects(this.position);
  }
}

module.exports = Chromosome;
