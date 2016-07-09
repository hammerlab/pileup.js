
import BigWig from '../data/BigWig';
import ContigInterval from '../ContigInterval';

// Flow type for export.
export type BigWigSource = {
  rangeChanged: (newRange: GenomeRange) => void;
  bucketingChanged: (newBuckets: number) => void;
  getValuesInRange: (range: ContigInterval<string>, basesPerBucket: number) => number[];
  on: (event: string, handler: Function) => void;
  off: (event: string) => void;
  trigger: (event: string, ...args:any) => void;
}

function createFromBigWigFile(source: BigWig): BigWigSource {
  // Ranges for which we have complete information -- no need to hit network.
  var coveredRanges: Array<ContigInterval<string>> = [];

  function getValuesInRange(range: ContigInterval<string>, basesPerBucket: number): number[] {
    if (!range) return [];
    var results = [];
    var start = range.start();
    var end = range.end();
    for (var pos = start; pos < end; pos += basesPerBucket) {

    }
    _.each(genes, gene => {
      if (range.intersects(gene.position)) {
        results.push(gene);
      }
    });
    return results;
  }

  function fetch(range: GenomeRange) {
    var interval = new ContigInterval(range.contig, range.start, range.stop);

    // Check if this interval is already in the cache.
    if (interval.isCoveredBy(coveredRanges)) {
      return Q.when();
    }

    coveredRanges.push(interval);
    coveredRanges = ContigInterval.coalesce(coveredRanges);

    return source.getFeatureBlocksOverlapping(interval).then(featureBlocks => {
      featureBlocks.forEach(fb => {
        coveredRanges.push(fb.range);
        coveredRanges = ContigInterval.coalesce(coveredRanges);
        var genes = fb.rows.map(parseBedFeature);
        genes.forEach(gene => addGene(gene));
        //we have new data from our internal block range
        o.trigger('newdata', fb.range);
      });
    });
  }

  var basesPerBucket = 0;
  var o = {
    bucketingChanged: (newBasesPerBucket: number) => {
      basesPerBucket = newBasesPerBucket;
    },
    rangeChanged: function(newRange: GenomeRange) {
      fetch(newRange).done();
    },
    getValuesInRange,

    // These are here to make Flow happy.
    on: () => {},
    off: () => {},
    trigger: () => {}
  };
  _.extend(o, Events);  // Make this an event emitter

  return o;
}

function create(data: {url:string}): BigWigSource {
  var url = data.url;
  if (!url) {
    throw new Error(`Missing URL from track: ${JSON.stringify(data)}`);
  }

  return createFromBigWigFile(new BigBed(url));
}

module.exports = {
  create,
  createFromBigWigFile
};
