/**
 * Common types used in many modules.
 * @flow
 */
'use strict';

import type * as React from 'react';

export type Track = {
  viz: Object;  // for now, a React class
  data: Object;  // This is a DataSource object
  cssClass?: string;
}

export type VisualizedTrack = {
  visualization: React.Component;
  source: Object;  // data source
  track: Track;  // for css class and options
}
