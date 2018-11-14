/**
 * Class for parsing variants.
 * @flow
 */
'use strict';

import ContigInterval from '../ContigInterval';

class Variant {
  contig: string;
  position: number;
  ref: string;
  alt: string;
  id: string;
  //this is the biggest allele frequency for single vcf entry
  //single vcf entry might contain more than one variant like the example below
  //20 1110696 rs6040355 A G,T 67 PASS NS=2;DP=10;AF=0.333,0.667;AA=T;DB
  majorFrequency: ?number;
  //this is the smallest allel frequency for single vcf entry
  minorFrequency: ?number;
  vcfLine: string;


  constructor(variant: Object) {
   this.contig = variant.contig;
   this.position = parseInt(variant.position);
   this.ref = variant.ref;
   this.alt = variant.alt;
   this.id = variant.id;
   this.majorFrequency = variant.majorFrequency;
   this.minorFrequency = variant.minorFrequency;
   this.vcfLine = variant.vcfLine;
  }

  static fromGA4GH(ga4ghVariant: Object): Variant {
   return new Variant(
    {
     contig: ga4ghVariant.referenceName,
     position: parseInt(ga4ghVariant.start),
     id: ga4ghVariant.id,
     ref: ga4ghVariant.referenceBases,
     alt: ga4ghVariant.alternateBases,
     majorFrequency: 0,
     minorFrequency: 0, // TODO extract these
     vcfLine: "" // TODO
   });
  }

  intersects(range: ContigInterval<string>): boolean {
    return intersects(this, range);
  }

}

function intersects(variant: Variant, range: ContigInterval<string>): boolean {
  return range.intersects(new ContigInterval(variant.contig, variant.position, variant.position + 1));
}


// holds variant and genotype sample ids
class VariantContext {
  variant: Variant;
  sampleIds: string[];

  constructor(variant: Object, sampleIds: string[]) {
    this.variant = variant;
    this.sampleIds = sampleIds;
  }
}

module.exports = {
  Variant,
  VariantContext,
  intersects
};
