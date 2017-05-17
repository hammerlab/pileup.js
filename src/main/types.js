/**
 * Common types used in many modules.
 *
 * Flow makes it difficult for a module to export both symbols and types. This
 * module serves as a dumping ground for types which we'd really like to export
 * from other modules.
 *
 * @flow
 */
'use strict';

// Public API

import type React from 'react';

export type VizWithOptions = {
  component: ReactClass;
  options: ?Object;
}

export type Track = {
  viz: VizWithOptions;
  data: Object;  // This is a DataSource object
  name?: string;
  cssClass?: string;
  isReference?: boolean;
}

export type VisualizedTrack = {
  visualization: VizWithOptions;
  source: Object;  // data source
  track: Track;  // for css class and options
}

/*
TODO(danvk): kill types/types.js and use this
export type GenomeRange = {
  contig: string;
  start: number;  // inclusive
  stop: number;  // inclusive
}
*/
export type PartialGenomeRange = {
  contig?: string;
  start?: number;
  stop?: number;
}

// BAM/BAI parsing

import type VirtualOffset from './data/VirtualOffset';

export type Chunk = {
  chunk_beg: VirtualOffset;
  chunk_end: VirtualOffset;
}

// src/utils.js
export type InflatedBlock = {
  offset: number;
  compressedLength: number;
  buffer: ArrayBuffer;
}
