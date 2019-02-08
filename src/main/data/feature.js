/**
 * Class for parsing features.
 * @flow
 */
'use strict';

import ContigInterval from '../ContigInterval';
import type {CoverageCount} from '../viz/pileuputils';

class Feature {
  id: string;
  featureType: string;
  position: ContigInterval<string>;
  score: number;

  constructor(feature: Object) {
    this.id = feature.id;
    this.featureType = feature.featureType;
    this.position = feature.position;
    this.score = feature.score;
  }

  getKey(): string {
    return this.id;
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


  static fromGA4GH(ga4ghFeature: Object): Feature {
    var position = new ContigInterval(ga4ghFeature.referenceName, parseInt(ga4ghFeature.start), parseInt(ga4ghFeature.end));
    return new Feature(
    {
      id: ga4ghFeature.id,
      featureType: ga4ghFeature.featureType,
      position: position,
      score: 1000
    });
  }

  intersects(range: ContigInterval<string>): boolean {
    return range.intersects(this.position);
  }
}

module.exports = Feature;
