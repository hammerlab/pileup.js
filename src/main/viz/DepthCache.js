/**
 * @flow
 */
'use strict';

import type {BinSummary} from './CoverageCache';

class DepthCache {
  maxCoverageForRef(ref: string): number {
    throw new Error("Not implemented");
  }
  binsForRef(ref: string): {[key: number]: BinSummary} {
    throw new Error("Not implemented");
  }
}

module.exports = DepthCache;