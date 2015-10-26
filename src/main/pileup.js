/**
 * This exposes the main entry point into pileup.js.
 * @flow
 */
'use strict';

var _ = require('underscore'),
    React = require('react'),
    ReactDOM = require('react-dom'),
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
  setRange(range: GenomeRange): void;
  getRange(): GenomeRange;
  destroy(): void;
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
  return _.find(tracks, t => !!t.track.isReference);
}

function create(elOrId: string|Element, params: PileupParams): Pileup {
  var el = typeof(elOrId) == 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) {
    throw new Error(`Attempted to create pileup with non-existent element ${elOrId}`);
  }

  var vizTracks = params.tracks.map(function(track: Track): VisualizedTrack {
    var source = track.data ? track.data : track.viz.component.defaultSource;
    if(!source) {
      throw new Error(
        `Track '${track.viz.component.displayName}' doesn't have a default ` +
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
      ReactDOM.render(<Root referenceSource={referenceTrack.source}
                            tracks={vizTracks}
                            initialRange={params.range} />, el);
  return {
    setRange(range: GenomeRange) {
      if (reactElement === null) {
        throw 'Cannot call setRange on a destroyed pileup';
      }
      reactElement.handleRangeChange(range);
    },
    getRange(): GenomeRange {
      if (reactElement === null) {
        throw 'Cannot call setRange on a destroyed pileup';
      }
      return _.clone(reactElement.state.range);
    },
    destroy(): void {
      if (!vizTracks) {
        throw 'Cannot call destroy() twice on the same pileup';
      }
      vizTracks.forEach(({source}) => {
        source.off();
      });
      ReactDOM.unmountComponentAtNode(el);
      reactElement = null;
      referenceTrack = null;
      vizTracks = null;
    }
  };
}

type VizObject = ((options: ?Object) => {component: React.Component, options:?Object});

function makeVizObject(component: React.Component): VizObject {
  return options => ({component, options});
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
    coverage: makeVizObject(CoverageTrack),
    genome:   makeVizObject(GenomeTrack),
    genes:    makeVizObject(GeneTrack),
    location: makeVizObject(LocationTrack),
    scale:    makeVizObject(ScaleTrack),
    variants: makeVizObject(VariantTrack),
    pileup:   makeVizObject(PileupTrack)
  }
};

module.exports = pileup;

// Export a global until the distributed package works with CommonJS
// See https://github.com/hammerlab/pileup.js/issues/136
if (typeof window !== 'undefined') {
  window.pileup = pileup;
}
