# pileup.js Design

## Classes

At a high level, pileup contains three types of classes:

1. *Data classes* These live in the `/data` directory.
   They provide an asynchronous API for remote data sources, hiding
   all the complexities of network access and parsing. For example, the `BAM`
   class provides a `getAlignmentsInRange` method which takes a genomic
   interval and returns a list of alignments.
   
   These classes are useful for anyone interested in working with genome data
   in a browser, not just for pileup.js and other genome browsers.

2. *Source classes* These live in the `/sources` directory.
   They provide a uniform, synchronous wrapper around the data classes. There's
   one source class for each data class, e.g. `BAM` and `BamDataSource`. They
   handle caching and speculative fetching, e.g. if I ask for `chr17:123-234`,
   the `BamDataSource` may choose to expand this to `chr17:100-300` in case I
   pan later. They also handle partial cache hits, e.g. if I request
   `chr17:123-234` and `chr17:100-200` was previously cached, then a smaller
   interval will be requested.

   These classes all have the same API:
   * They are created from a spec object (with a `url` field)
   * They have a `rangeChanged` method to receive notifications that the
     currently-visible portion of the genome has changed.
   * They have a `getFeaturesInRange` method which returns cached features in a
     genomic range.
   * They have standard `on` / `off` / `trigger` methods which allow clients to
     receive notifications when data becomes available.

   The usual sequence is that the user will pan, which will fire
   `rangeChanged`, which will request new features from a data class, which
   will eventually fire `on('newdata')`, which will cause one of the
   visualizations to call `getFeaturesInRange` and put the newly-available data
   on the screen.

3. *Visualization classes* These live in the `/viz` directory.
   The visualizations are all [React.js][] classes. They mostly serve as thin
   wrappers around the HTML canvas, which is used for rendering. The `props`
   for the React components include the `height` and `width` of the element, as
   well as the currently-visible `range`. When the user pans, each component
   will have its `props` change to reflect the new range.

   Visualizations typically listen for `newdata` events on the sources that are
   of interest to them. These trigger redraws. More complex visualizations use
   a `TiledCanvas` to minimize redraws, which are expensive and lead to dropped
   frames while panning.

   Each visualization is associated with a source. It gets references to both
   this source and to the reference via `props`.

The source and visualization classes are exposed to users via `pileup.formats`
and `pileup.viz`, respectively. The data classes are not exposed directly, but
users can `import` them explicitly if they so desire.

## Coordinates

pileup.js has a few ways of representing genomic coordinates and ranges:

* `Interval` This class represents a closed interval, `[a, b]`.
  Since this is a generic interval, it's not specified whether the numbers are
  zero- or one-based.

* `ContigInterval` This class represents a range in the genome, e.g. a
  chromosome name plus a range. Depending on the context, the chromosome might
  be a name (`chr22`) or just a number (21). Coordinates are zero-based.
  Because data sources are spectacularly inconsistent about whether it's called
  `chr17` or just `17`, this class provides many methods which ignore these
  ambiguities. This class is used almost exclusively throughout pileup.js to
  represent ranges in a genome.

* `GenomeRange` This is a JSON-compatible object, `{contig, start, stop}`.
  It is used in the public API and in some places in the React component tree.

Generally `Interval` and `ContigInterval` should be used internally within
pileup.js. Because the `ContigInterval` class is not part of the public API,
it's better for coordinates to be consumed and provided to users as
`GenomeRange`s, e.g. for `getRange` and `setRange`.

## Examples

Here's how you might fetch some reads using the `BAM` data class:

```javascript
// Create the Bam data source. This will load the index.
var bam = new Bam(new RemoteFile('alignments.bam'),
                  new RemoteFile('alignments.bam.bai'));

// Fetch the reads. This returns a Promise object.
var range = new ContigInterval('chr17', 10000, 11000);
var promise = bam.getAlignmentsInRange(range);

// The alignments will be available when the Promise resolves.
promise.then(function(alignments) {
  alert(alignments[0].getSequence());
});
```

Here's how this might look with `BamDataSource`:

```javascript
// Create a BAM data source using a spec object.
var source = new BamDataSource({
  url: 'alignments.bam',
  indexUrl: 'alignments.bam.bai'
});

var range = new ContigInterval('chr17', 10000, 11000);

// Register a listener for new data.
function countAlignments() {
  console.log(source.getAlignmentsInRange(range).length);
}
source.on('newdata', countAlignments);

// Tell the source to fetch some data.
source.rangeChanged({contig: 'chr17', start: 10000, stop: 11000});

countAlignments();  // will log '0' -- nothing has loaded yet!
// ... after the data loads, the 'newdata' callback will log something >0.
```

[React.js]: https://facebook.github.io/react/
