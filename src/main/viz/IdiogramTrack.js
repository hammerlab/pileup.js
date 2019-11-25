/**
 * A track which shows an idiogram corresponding to the genome being
 * shown by the reference track.
 * @flow
 */
'use strict';

import type {VizProps} from '../VisualizationWrapper';
import type {State} from '../types';
import type {DataSource} from '../sources/DataSource';
import React from 'react';
import EmptySource from '../sources/EmptySource';
import ContigInterval from '../ContigInterval';
import Chromosome from '../data/chromosome';
import type Band from '../data/chromosome';
import canvasUtils from './canvas-utils';
import dataCanvas from 'data-canvas';
import style from '../style';

import ReactDOM from 'react-dom';
import shallowEquals from 'shallow-equals';
import d3utils from './d3utils';
import _ from 'underscore';
import scale from '../scale';
import Interval from '../Interval';

import GenericFeature from '../data/genericFeature';
import {GenericFeatureCache} from './GenericFeatureCache';

function gstainFiller(d) {
    var stain = d.value;
    if (stain == "gneg") {
      return '#dfdfdf';
    } else if (stain == "gpos") {
      return '#525252';
    } else if (stain == "acen") {
      return null;
    } else if (stain == "gvar") {
      return '#cfcfcf';
    } else if (stain == "stalk") {
      return '#cfcfcf';
    } else {
      return 'white';
    }
}

class IdiogramTrack extends React.Component<VizProps<DataSource<Chromosome>>, State> {
  props: VizProps<DataSource<Chromosome>>;
  state: State;
  cache: GenericFeatureCache;

  constructor(props: VizProps<DataSource<Chromosome>>) {
    super(props);
    this.state = {
      networkStatus: null
    };
  }

  render(): any {
    return <canvas />;
  }

  componentDidMount() {
    this.cache = new GenericFeatureCache(this.props.referenceSource);
    // Visualize new reference data as it comes in from the network.
    this.props.source.on('newdata', (range) => {
      // add to generic cache
      var chrs = this.props.source.getFeaturesInRange(range);
      chrs.forEach(chr => this.cache.addFeature(new GenericFeature(chr.name, chr.position, chr))) ;
      this.updateVisualization();
    });
    this.props.referenceSource.on('newdata', range => {
      this.updateVisualization();
    });
    this.props.source.on('networkprogress', e => {
      this.setState({networkStatus: e});
    });
    this.props.source.on('networkdone', e => {
      this.setState({networkStatus: null});
    });

    this.updateVisualization();
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(this.props, prevProps) ||
      !shallowEquals(this.state, prevState)) {
      this.updateVisualization(prevProps);
    }
  }

  updateVisualization(prevProps: any) {
    var canvas = ReactDOM.findDOMNode(this),
      {width, height} = this.props;

    var range = new ContigInterval(this.props.range.contig, this.props.range.start, this.props.range.stop);

    if (!prevProps || !range.chrOnContig(prevProps.range.contig)) {
      this.updateChromosome(canvas, height, width,range);
    }
    this.updateChromosomeLocation(canvas, height, width, range);
  }

  updateChromosomeLocation(canvas, height, width,range) {
    var chrs = _.flatten(_.map(this.cache.getGroupsOverlapping(range),
      g => g.items));

    if (!chrs || chrs.length == 0) {
      return;
    }
    var chr = chrs[0];
    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));

    var iv = {'start':chr.position.start(),
      'stop': chr.position.stop()};
    var sc = d3utils.getTrackScale(iv, this.props.width);

    var width = Math.ceil(sc(range.stop()) - sc(range.start()) );
    ctx.strokeStyle='red';
    ctx.strokeRect(sc(range.start()),
                 0,
                 width,
                 style.READ_HEIGHT);

    ctx.popObject();
  }

  updateChromosome(canvas, height, width, range) {

    // Hold off until height & width are known.
    if (width === 0 || typeof canvas == 'undefined') return;

    d3utils.sizeCanvas(canvas, width, height);
    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));

    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    height = d3utils.heightForCanvas(canvas, style.READ_HEIGHT);

    var chrs = _.flatten(_.map(this.cache.getGroupsOverlapping(range),
                  g => g.items));

    chrs.forEach(chr => {
      var iv = {'start':chr.position.start(),
        'stop': chr.position.stop()};
      var sc = d3utils.getTrackScale(iv, this.props.width),
        clampedScale = scale.linear()
            .domain([sc.invert(0), sc.invert(width)])
            .range([0, width])
            .clamp(true);

      // add bands
      var band_sc = d3utils.getTrackScale(iv, this.props.width);
      chr.gFeature.bands.forEach(band => {
        var filler = gstainFiller(band);

        var width = Math.ceil(band_sc(band.end) - band_sc(band.start));
        var start = band_sc(band.start)+style.IDIOGRAM_LINEWIDTH;

        if (!filler) {
          ctx.fillStyle='red';
          ctx.beginPath();
          if (band.name.startsWith("p")) {
            ctx.moveTo(start, style.IDIOGRAM_LINEWIDTH);
            ctx.lineTo(start+width,style.READ_HEIGHT/2);
            ctx.lineTo(start, style.READ_HEIGHT);
            ctx.fill();
          } else {
            ctx.moveTo(start, style.READ_HEIGHT/2);
            ctx.lineTo(start+width,style.IDIOGRAM_LINEWIDTH);
            ctx.lineTo(start+width, style.READ_HEIGHT);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = filler;
          ctx.fillRect(start,
                       style.IDIOGRAM_LINEWIDTH,
                       width,
                       style.READ_HEIGHT);
        }
      });

    })
    ctx.popObject();
  }

}

IdiogramTrack.displayName = 'idiogram';
IdiogramTrack.defaultSource = EmptySource.create();

module.exports = IdiogramTrack;
