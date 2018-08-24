/*
 * This is a dummy data source to be used by tracks that do not depend on data.
 * @flow
 */
'use strict';

import type {GenomeRange} from '../types';

type EmptySource = {
  rangeChanged: (newRange: GenomeRange) => void;
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
}

var create = (): EmptySource => ({
  rangeChanged: () => {},
  on: () => {},
  off: () => {},
  trigger: () => {}
});

module.exports = {
  create
};
