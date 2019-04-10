/**
 * A track which shows a scale proportional to slice of the genome being
 * shown by the reference track. This track tries to show a scale in kbp,
 * mbp or gbp depending on the size of the view and also tries to round the
 * scale size (e.g. prefers "1,000 bp", "1,000 kbp" over "1 kbp" and "1 mbp")
 *
 *           <---------- 30 bp ---------->
 *
 * @flow
 */
'use strict';

import type {VizProps} from '../VisualizationWrapper';
import type {Scale} from './d3utils';
import type {State} from '../types';
import React from 'react';
import ReactDOM from 'react-dom';
import EmptySource from '../sources/EmptySource';
import canvasUtils from './canvas-utils';
import dataCanvas from 'data-canvas';
import style from '../style';
import d3utils from './d3utils';
import d3 from 'd3';
// import d3 from '../../../node_modules/idiogrammatik.js/d3'
import idiogrammatik from '../../../node_modules/idiogrammatik.js/idiogrammatik';


class KaryogramTrack extends React.Component<VizProps<void>, State> {
  props: VizProps<void>;
  state: State;  // no state, used to make flow happy
  static defaultSource: Object;

  constructor(props: VizProps<void>) {
    super(props);
  }

  render(): any {
    return <div id="karyogram"></div>;
  }

  componentDidMount() {
    var _d3;
    if (typeof d3 === 'undefined') {
      if (typeof require === 'function') {
        // Don't overwrite a global d3 instance.
        _d3 = require('d3');
      } else {
        throw new Error("d3.js must be included before idiogrammatik.js.");
      }
    } else {
      _d3 = d3;
    }

    var kgram = idiogrammatik();
      //   .on('click', function(evt) {
      //   var position = kgram.position(this);
      //   console.log(position);
      // })
      // .on('mouseover', function(evt) {
      //   var position = kgram.position(this);
      //   console.log(position);
      // });

    kgram.width([1320]);
    kgram.height([20]);
    kgram.margin({'top': 5, 'bottom': 10, 'left': 20, 'right': 20});
    kgram.idiogramHeight([10]);

    d3.json("../../../test-data/gstained_chromosomes_data.json", function(err, data) {
      console.log(data);
      console.log(err);

      d3.select('#karyogram')
        .datum(data)
        .call(kgram);
    });
    this.updateVisualization();
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    this.updateVisualization();
  }

  // getDOMNode(): any {
  //   return ReactDOM.findDOMNode(this);
  // }

  updateVisualization() {

  }
}

KaryogramTrack.displayName = 'karyogram';
KaryogramTrack.defaultSource = EmptySource.create();

module.exports = KaryogramTrack;
