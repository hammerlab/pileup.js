/**
 * This exposes the main entry point into pileup.js.
 * @flow
 */
'use strict';

var _ = require('underscore'),
    React = require('./react-shim'),
    // Data sources
    TwoBitDataSource = require('./TwoBitDataSource'),
    BigBedDataSource = require('./BigBedDataSource'),
    VcfDataSource = require('./VcfDataSource'),
    BamDataSource = require('./BamDataSource'),
    GA4GHDataSource = require('./GA4GHDataSource'),
    EmptySource = require('./EmptySource'),
    // Visualizations
    CoverageTrack = require('./CoverageTrack'),
    GenomeTrack = require('./GenomeTrack'),
    GeneTrack = require('./GeneTrack'),
    LocationTrack = require('./LocationTrack'),
    PileupTrack = require('./PileupTrack'),
    ScaleTrack = require('./ScaleTrack'),
    VariantTrack = require('./VariantTrack'),
    Root = require('./Root');

import type {Track, VisualizedTrack} from './types';

type GenomeRange = {
  contig: string;
  start: number;
  stop: number;
}

type Pileup = {
  setRange: (range: GenomeRange)=>void;
  getRange(): GenomeRange;
}

type PileupParams = {
  range: {
    contig: string,
    start: number,
    stop: number
  };
  tracks: Track[];
}

function findReference(tracks: VisualizedTrack[]): ?VisualizedTrack {
  return _.findWhere(tracks, t => t.track.isReference);
}

function create(elOrId: string|Element, params: PileupParams): Pileup {
  var el = typeof(elOrId) == 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) {
    throw new Error(`Attempted to create pileup with non-existent element ${elOrId}`);
  }

  var vizTracks = params.tracks.map(function(track) {
    var source = track.data ? track.data : track.viz.defaultSource;
    if(!source) {
      throw new Error(
        `Track '${track.viz.displayName}' doesn't have a default ` +
        `data source; you must specify one when initializing it.`
      );
    }

    return {visualization: track.viz, source, track};
  });

  var referenceTrack = findReference(vizTracks);
  if (!referenceTrack) {
    throw new Error('You must include at least one track with type=reference');
  }

  var reactElement =
      React.render(<Root referenceSource={referenceTrack.source}
                         tracks={vizTracks}
                         initialRange={params.range} />, el);
  return {
    setRange(range: GenomeRange) {
      reactElement.handleRangeChange(range);
    },
    getRange(): GenomeRange {
      return reactElement.state.range;
    }
  };
}

var pileup = {
  create: create,
  formats: {
    bam: BamDataSource.create,
    ga4gh: GA4GHDataSource.create,
    vcf: VcfDataSource.create,
    twoBit: TwoBitDataSource.create,
    bigBed: BigBedDataSource.create,
    empty: EmptySource.create
  },
  viz: {
    coverage: () => CoverageTrack,
    genome: () => GenomeTrack,
    genes: () => GeneTrack,
    location: () => LocationTrack,
    scale: () => ScaleTrack,
    variants: () => VariantTrack,
    pileup: () => PileupTrack
  }
};

module.exports = pileup;

// Export a global until the distributed package works with CommonJS
// See https://github.com/hammerlab/pileup.js/issues/136
if (typeof window !== 'undefined') {
  window.pileup = pileup;
}
