
import WiggleCache from './WiggleCache';
import BigWigSource from '../sources/BigWigDataSource';
import ContigInterval from '../ContigInterval';

type Props = {
  width: number;
  height: number;
  range: GenomeRange;
  basesPerBucket: number;
  source: BigWigSource;
  //referenceSource: TwoBitSource;
  // options: {
  //   vafColorThreshold: number
  // }
};

// type State = {
//
// }

class WiggleTrack extends React.Component {
  props: Props;
  state: void;
  cache: WiggleCache;
  tiles: CoverageTiledCanvas;

  constructor(props: Props) {
    super(props);
  }

  render(): any {
    return <canvas ref='canvas' onClick={this.handleClick.bind(this)} />;
  }

  getScale(): Scale {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  componentDidMount() {
    this.cache = new WiggleCache(this.props.referenceSource);
    this.tiles = new CoverageTiledCanvas(this.cache, this.props.height, this.props.options);

    var basesPerBucket = this.props.basesPerBucket;
    this.props.source.on('newdata', range => {
      var oldMax = this.cache.maxCoverageForRef(range.contig);
      this.props.source.getValuesInRange(range, basesPerBucket)
        .forEach(read => this.cache.addValue(read));
      var newMax = this.cache.maxCoverageForRef(range.contig);

      if (oldMax != newMax) {
        this.tiles.invalidateAll();
      } else {
        this.tiles.invalidateRange(range);
      }
      this.visualizeCoverage();
    });

    this.props.referenceSource.on('newdata', range => {
      this.cache.updateMismatches(range);
      this.tiles.invalidateRange(range);
      this.visualizeCoverage();
    });
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(this.props, prevProps) ||
      !shallowEquals(this.state, prevState)) {
      if (this.props.height != prevProps.height ||
        this.props.options != prevProps.options) {
        this.tiles.update(this.props.height, this.props.options);
        this.tiles.invalidateAll();
      }
      this.visualizeCoverage();
    }
  }

  getContext(): CanvasRenderingContext2D {
    var canvas = (this.refs.canvas : HTMLCanvasElement);
    // The typecast through `any` is because getContext could return a WebGL context.
    var ctx = ((canvas.getContext('2d') : any) : CanvasRenderingContext2D);
    return ctx;
  }

  // Draw three ticks on the left to set the scale for the user
  renderTicks(ctx: DataCanvasRenderingContext2D, yScale: (num: number)=>number) {
    var axisMax = yScale.domain()[0];
    [0, Math.round(axisMax / 2), axisMax].forEach(tick => {
      // Draw a line indicating the tick
      ctx.pushObject({value: tick, type: 'tick'});
      var tickPosY = Math.round(yScale(tick));
      ctx.strokeStyle = style.COVERAGE_FONT_COLOR;
      canvasUtils.drawLine(ctx, 0, tickPosY, style.COVERAGE_TICK_LENGTH, tickPosY);
      ctx.popObject();

      var tickLabel = tick + 'X';
      ctx.pushObject({value: tick, label: tickLabel, type: 'label'});
      // Now print the coverage information
      ctx.font = style.COVERAGE_FONT_STYLE;
      var textPosX = style.COVERAGE_TICK_LENGTH + style.COVERAGE_TEXT_PADDING,
        textPosY = tickPosY + style.COVERAGE_TEXT_Y_OFFSET;
      // The stroke creates a border around the text to make it legible over the bars.
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeText(tickLabel, textPosX, textPosY);
      ctx.lineWidth = 1;
      ctx.fillStyle = style.COVERAGE_FONT_COLOR;
      ctx.fillText(tickLabel, textPosX, textPosY);
      ctx.popObject();
    });
  }

  visualizeCoverage() {
    var canvas = (this.refs.canvas : HTMLCanvasElement),
      width = this.props.width,
      height = this.props.height,
      range = ContigInterval.fromGenomeRange(this.props.range);

    // Hold off until height & width are known.
    if (width === 0) return;
    d3utils.sizeCanvas(canvas, width, height);

    var ctx = dataCanvas.getDataContext(this.getContext());
    ctx.save();
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    var yScale = this.tiles.yScaleForRef(range.contig);

    this.tiles.renderToScreen(ctx, range, this.getScale());
    this.renderTicks(ctx, yScale);

    ctx.restore();
  }

  handleClick(reactEvent: any) {
    var ev = reactEvent.nativeEvent,
      x = ev.offsetX;

    // It's simple to figure out which position was clicked using the x-scale.
    // No need to render the scene to determine what was clicked.
    var range = ContigInterval.fromGenomeRange(this.props.range),
      xScale = this.getScale(),
      bins = this.cache.binsForRef(range.contig),
      pos = Math.floor(xScale.invert(x)) - 1,
      bin = bins[pos];

    var alert = window.alert || console.log;
    if (bin) {
      var mmCount = bin.mismatches ? _.reduce(bin.mismatches, (a, b) => a + b) : 0;
      var ref = bin.ref || this.props.referenceSource.getRangeAsString(
          {contig: range.contig, start: pos, stop: pos});

      // Construct a JSON object to show the user.
      var messageObject = _.extend(
        {
          'position': range.contig + ':' + (1 + pos),
          'read depth': bin.count
        },
        bin.mismatches);
      messageObject[ref] = bin.count - mmCount;
      alert(JSON.stringify(messageObject, null, '  '));
    }
  }
}

WiggleTrack.displayName = 'coverage';

module.exports = WiggleTrack;
