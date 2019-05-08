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
import type {State} from '../types';
import type {DataSource} from '../sources/DataSource';
import React from 'react';
import EmptySource from '../sources/EmptySource';
import d3 from 'd3';
import idiogrammatik from '../../../node_modules/idiogrammatik.js/idiogrammatik';
import ContigInterval from '../ContigInterval';
import Chromosome from '../data/chromosome';



class KaryogramTrack extends React.Component<VizProps<DataSource<Chromosome>>, State> {
  props: VizProps<DataSource<Chromosome>>;
  state: State;  // no state, used to make flow happy
  source: DataSource<Chromosome>;
  kgram: Object;
  data: Object;

  constructor(props: VizProps<DataSource<Chromosome>>) {
    super(props);
    this.source = this.props.source;
    this.kgram = {};
    this.data = {};
  }


  componentDidMount() {

    this.kgram = idiogrammatik();

    this.kgram.width([1320]);
    this.kgram.height([20]);
    this.kgram.margin({'top': 5, 'bottom': 10, 'left': 20, 'right': 20});
    this.kgram.idiogramHeight([10]);

    var range = this.props.range;
    var relaxedRange =
        new ContigInterval(range.contig, range.start, range.stop);
    this.data = this.source.getFeaturesInRange(relaxedRange);

    d3.select('#karyogram')
      .datum(this.data)
      .call(this.kgram);

    this.updateVisualization(this.props.range);
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    this.updateVisualization(this.props.range);
  }

  updateVisualization(range: '') {
    this.kgram.zoom(range.contig, range.start, range.stop);
  }

  render(): any {
    return <div id="karyogram"></div>;
  }
}

KaryogramTrack.displayName = 'karyogram';
KaryogramTrack.defaultSource = EmptySource.create();

module.exports = KaryogramTrack;
