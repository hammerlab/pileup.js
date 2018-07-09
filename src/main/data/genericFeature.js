/**
 * Generic object that can be displayed. This can be a gene, feature or variant, etc.
 * See ../viz/GenericFeatureCache.js
 * @flow
 */
'use strict';

/*jshint unused:false */
import ContigInterval from '../ContigInterval';


class GenericFeature {
  id: string;
  position: ContigInterval<string>;
  gFeature: Object;

  constructor(id: string, position: ContigInterval<string>, genericFeature: Object) {
    this.id = genericFeature.id;
    this.position = genericFeature.position;
    this.gFeature = genericFeature;
  }
}

module.exports = GenericFeature;
