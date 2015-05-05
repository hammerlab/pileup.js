/**
 * Common types used in many modules.
 * @flow
 */
'use strict';

import type * as React from 'react';

export type Track = {
  viz: string;  // in the future: string|Object
  data: {
    type?: string;
    url?: string;
    source?: Object;
    indexUrl?: string;  // e.g. for BamFile
  };  // either url: string or source: Object
  cssClass?: string;
  options?: Object;
}

export type VisualizedTrack = {
  visualization: React.Component;
  source: Object;  // data source
  track: Track;  // for css class and options
}
