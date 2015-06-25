/* @flow */
'use strict';

var expect = require('chai').expect;

var Bam = require('../main/bam'),
    BamDataSource = require('../main/BamDataSource'),
    ContigInterval = require('../main/ContigInterval'),
    MappedRemoteFile = require('./MappedRemoteFile');

describe('BamDataSource', function() {
  function getTestSource() {
    // See test/data/README.md for provenance of these files.
    var remoteBAI = new MappedRemoteFile('/test-data/dream.synth3.bam.bai.mapped',
                                         [[8054040, 8242920]]),
        remoteBAM = new MappedRemoteFile('/test-data/dream.synth3.bam.mapped',
                                         [[0, 69453], [163622109888, 163622739903]]);

    var bam = new Bam(remoteBAM, remoteBAI, {
      // "chunks" is usually an array; here we take advantage of the
      // Object-like nature of JavaScript arrays to create a sparse array.
      "chunks": { "19": [8054040, 8242920] },
      "minBlockIndex": 69454
    });

    return BamDataSource.createFromBamFile(bam);
  }

  it('should extract features in a range', function(done) {
    this.timeout(5000);
    var source = getTestSource();

    // This range matches the "large, dense" test in bam-test.js
    var range = new ContigInterval('20', 31511349, 31514172);
    var reads = source.getAlignmentsInRange(range);
    expect(reads).to.deep.equal([]);

    source.on('newdata', () => {
      var reads = source.getAlignmentsInRange(range);
      expect(reads).to.have.length(1112);
      expect(reads[0].toString()).to.equal('20:31511251-31511351');
      expect(reads[1111].toString()).to.equal('20:31514171-31514271');
      done();
    });
    source.rangeChanged({
      contig: range.contig,
      start: range.start(),
      stop: range.stop()
    });
  });

  it('should fetch nearby features', function(done) {
    this.timeout(5000);
    var source = getTestSource();

    // Requests are for 'chr20', while the canonical name is just '20'.
    var range       = new ContigInterval('chr20', 31512050, 31512150),
        rangeBefore = new ContigInterval('chr20', 31512000, 31512050),
        rangeAfter  = new ContigInterval('chr20', 31512150, 31512199);

    var reads = source.getAlignmentsInRange(range);
    expect(reads).to.deep.equal([]);

    var networkEvents = [];
    source.on('networkprogress', event => { networkEvents.push(event) });
    source.on('networkdone', () => { networkEvents.push('networkdone') });

    // Fetching [50, 150] should cache [0, 200]
    source.on('newdata', () => {
      var reads = source.getAlignmentsInRange(range);
      expect(reads).to.have.length(18);
      expect(reads[0].toString()).to.equal('20:31511951-31512051');
      expect(reads[17].toString()).to.equal('20:31512146-31512246');

      var readsBefore = source.getAlignmentsInRange(rangeBefore),
          readsAfter = source.getAlignmentsInRange(rangeAfter);

      expect(readsBefore).to.have.length(26);
      expect(readsAfter).to.have.length(12);

      expect(networkEvents).to.deep.equal([
        // TODO: figure out why this notification is getting dropped.
        // {'status': 'Fetching BAM header'},
        {'status': 'Fetching BAM index'},
        {'numRequests': 1},
        {'numRequests': 2},
        {'numRequests': 3},
        {'numRequests': 4},
        'networkdone'
      ]);

      // TODO: test that fetching readsBefore and readsAfter produces no
      // new network fetches.
      done();
    });
    source.rangeChanged({
      contig: range.contig,
      start: range.start(),
      stop: range.stop()
    });
  });
});
