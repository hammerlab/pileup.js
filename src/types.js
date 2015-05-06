/**
 * Common types used in many modules.
 * @flow
 */
'use strict';

import type * as React from 'react';

export type Track = {
  viz: string;  // in the future: string|Object
  data: Object;  // This is a DataSource object
  cssClass?: string;
}

export type VisualizedTrack = {
  visualization: React.Component;
  source: Object;  // data source
  track: Track;  // for css class and options
}
