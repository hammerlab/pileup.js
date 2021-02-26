/**
 * A track which shows an idiogram.
 *
 * @flow
 */
'use strict';

import type {VizProps} from '../VisualizationWrapper';
import type {State} from '../types';
import type {DataSource} from '../sources/DataSource';
import React from 'react';
import ContigInterval from '../ContigInterval';
import Chromosome from '../data/chromosome';
import canvasUtils from './canvas-utils';
import dataCanvas from 'data-canvas';
import style from '../style';

import shallowEquals from 'shallow-equals';
import d3utils from './d3utils';
import _ from 'underscore';

import GenericFeature from '../data/genericFeature';
import {GenericFeatureCache} from './GenericFeatureCache';

function gstainFiller(d): string {
  var stain = style.IDIOGRAM_COLORS[d.value];
  if (stain === undefined) {
    return 'white';
  } else {
    return stain;
  }
}

class IdiogramTrack extends React.Component<VizProps<DataSource<Chromosome>>, State> {
  props: VizProps<DataSource<Chromosome>>;
  state: State;
  cache: GenericFeatureCache;
  ref: Object

  constructor(props: VizProps<DataSource<Chromosome>>) {
    super(props);
    this.ref = React.createRef();
    this.state = {
      networkStatus: null
    };
  }

  render(): any {
    return <canvas ref={this.ref} />;
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
    const canvas = this.ref.current;
    var  {width, height} = this.props;

    var range = new ContigInterval(this.props.range.contig, this.props.range.start, this.props.range.stop);

    // Hold off until height & width are known.
    if (width === 0 || typeof canvas == 'undefined' || canvas == null) return;

    this.updateChromosome(canvas, height, width,range);
    this.updateChromosomeLocation(canvas, height, width, range);
  }

  updateChromosomeLocation(canvas: Object, height: number, width: number ,range: ContigInterval<string>) {
    var chrs = _.flatten(_.map(this.cache.getGroupsOverlapping(range),
      g => g.items));


    // Hold off until height & width are known.
    if (width === 0 || typeof canvas == 'undefined' || canvas == null) return;

    if (!chrs || chrs.length == 0) {
      return;
    }
    var chr = chrs[0];
    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));

    var iv = {'start':chr.position.start(),
      'stop': chr.position.stop()};
    var sc = d3utils.getTrackScale(iv, this.props.width);

    var viewWidth = Math.ceil(sc(range.stop()) - sc(range.start()) );
    ctx.strokeStyle='red';
    ctx.strokeRect(sc(range.start()),
                 style.IDIOGRAM_LINEWIDTH*2,
                 viewWidth,
                 style.READ_HEIGHT);

    ctx.popObject();
  }

  updateChromosome(canvas: Object, height: number, width: number, range: ContigInterval<string>) {

    // Hold off until height & width are known.
    if (width === 0 || typeof canvas == 'undefined' || canvas == null) return;

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
      // add bands
      var band_sc = d3utils.getTrackScale(iv, this.props.width);
      chr.gFeature.bands.forEach(band => {
        ctx.pushObject(band);
        var filler = gstainFiller(band);

        var width = Math.ceil(band_sc(band.end) - band_sc(band.start));
        var start = band_sc(band.start)+style.IDIOGRAM_LINEWIDTH;


        if (band.value == "acen") {
          ctx.fillStyle='red';
          ctx.beginPath();
          if (band.name.startsWith("p")) {
            ctx.moveTo(start+style.IDIOGRAM_LINEWIDTH, style.IDIOGRAM_LINEWIDTH*2 );
            ctx.lineTo(start+width,style.READ_HEIGHT/2);
            ctx.lineTo(start+style.IDIOGRAM_LINEWIDTH, style.READ_HEIGHT+style.IDIOGRAM_LINEWIDTH);
            ctx.fill();
          } else {
            ctx.moveTo(start+style.IDIOGRAM_LINEWIDTH, style.READ_HEIGHT/2);
            ctx.lineTo(start+width,style.IDIOGRAM_LINEWIDTH*2);
            ctx.lineTo(start+width, style.READ_HEIGHT+style.IDIOGRAM_LINEWIDTH);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = filler;
          ctx.strokeStyle = 'black';
          ctx.fillRect(start,
                       style.IDIOGRAM_LINEWIDTH*2,
                       width,
                       style.READ_HEIGHT);
          ctx.strokeRect(start,
                      style.IDIOGRAM_LINEWIDTH*2,
                      width,
                      style.READ_HEIGHT);
        }
        ctx.popObject();
      });
    });
  }

}

IdiogramTrack.displayName = 'idiogram';

module.exports = IdiogramTrack;
