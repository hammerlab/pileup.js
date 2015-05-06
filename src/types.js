/**
 * Common types used in many modules.
 * @flow
 */
'use strict';

import type * as React from 'react';

export type TrackData = {
  // A data source, e.g. pileup.formats.bam
  type?: (data: TrackData)=>Object;

  // Alternatively the track type will be deduced from the URL.
  url?: string;
  indexUrl?: string;  // e.g. for BamFile
}

export type Track = {
  viz: string;  // in the future: string|Object
  data: TrackData|Object;  // Object is a DataSource
  cssClass?: string;
  options?: Object;
}

export type VisualizedTrack = {
  visualization: React.Component;
  source: Object;  // data source
  track: Track;  // for css class and options
}
