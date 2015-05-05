/**
 * Common types used in many modules.
 * @flow
 */
'use strict';

import type * as React from 'react';

export type Track = {
  type: string;
  data: Object;  // either url: string or source: Object
  cssClass: ?string;
  options: ?Object;
}

export type VisualizedTrack = {
  visualization: React.Component;
  source: Object;  // data source
  track: Track;  // for css class and options
}
