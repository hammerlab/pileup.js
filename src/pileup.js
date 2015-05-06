/**
 * This exposes the main entry point into pileup.js.
 * @flow
 */
'use strict';

var _ = require('underscore'),
    React = require('react'),
    // Data sources
    TwoBitDataSource = require('./TwoBitDataSource'),
    BigBedDataSource = require('./BigBedDataSource'),
    VcfDataSource = require('./VcfDataSource'),
    BamDataSource = require('./BamDataSource'),
    // Visualizations
    GenomeTrack = require('./GenomeTrack'),
    GeneTrack = require('./GeneTrack'),
    PileupTrack = require('./PileupTrack'),
    VariantTrack = require('./VariantTrack'),
    Root = require('./Root');

import type {Track, VisualizedTrack} from './types';

type Pileup = {
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

var typeToSource = {
  '2bit': TwoBitDataSource,
  'bigbed': BigBedDataSource,
  'vcf': VcfDataSource,
  'bam': BamDataSource
};

var extToSource = {
  '2bit': '2bit',
  '2b': '2bit',
  'bb': 'bigbed',
  'vcf': 'vcf',
  'bam': 'bam'
};

function getSource(track: Track): Object {
  var data = track.data;
  if (data.type) {
    return data.type(data);
  }

  var url = data.url;
  if (!url) {
    throw new Error(`You must specify either 'type' or 'url' in a data source (got ${data})`);
  }

  // Attempt to deduce the data type from the URL's file extension
  var ext = url.slice(url.lastIndexOf('.') + 1);
  var type = extToSource[ext.toLowerCase()];
  if (!type) {
    throw new Error(`Unable to deduce data type frome extension ${ext}: ${url}}`);
  }
  return typeToSource[type].createFromTrack(data);
}

function makeVisualization(track: Track): React.Component {
  // TODO: switch to some kind of registration system?
  switch (track.viz) {
    case 'genome':
      return GenomeTrack;
    case 'genes':
      return GeneTrack;
    case 'variants':
      return VariantTrack;
    case 'pileup':
      return PileupTrack;
  }
}

function create(elOrId: string|Element, params: PileupParams): Pileup {
  var el = typeof(elOrId) == 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) {
    throw new Error(`Attempted to create pileup with non-existent element ${elOrId}`);
  }

  var vizTracks = params.tracks.map(track => ({
    visualization: makeVisualization(track),
    source: getSource(track),
    track
  }));

  var referenceTrack = findReference(vizTracks);
  if (!referenceTrack) {
    throw new Error('You must include at least one track with type=reference');
  }

  return React.render(<Root referenceSource={referenceTrack.source}
                            tracks={vizTracks}
                            initialRange={params.range} />, el);
}

module.exports = {
  create,
  formats: {
    bam: BamDataSource.createFromTrack,
    vcf: VcfDataSource.createFromTrack,
    twoBit: TwoBitDataSource.createFromTrack,
    bigBed: BigBedDataSource.createFromTrack
  }
};
