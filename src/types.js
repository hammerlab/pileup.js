/**
 * Common types used in many modules.
 * @flow
 */
'use strict';

export type Track = {
  type: string;
  data: Object;  // either url: string or source: Object
  cssClass: ?string;
  options: ?Object;
}
