/**
 * This tests that pileup mismatches are rendered correctly, regardless of the
 * order in which the alignment and reference data come off the network.
 * @flow
 */
'use strict';

import type SamRead from '../../main/data/SamRead';

import {expect} from 'chai';

import Q from 'q';
import _ from 'underscore';

import pileup from '../../main/pileup';
import TwoBit from '../../main/data/TwoBit';
import TwoBitDataSource from '../../main/sources/TwoBitDataSource';
import Bam from '../../main/data/bam';
import BamDataSource from '../../main/sources/BamDataSource';
import RemoteFile from '../../main/RemoteFile';
import MappedRemoteFile from '../MappedRemoteFile';
import ContigInterval from '../../main/ContigInterval';
import {waitFor} from '../async';
import dataCanvas from 'data-canvas';

global.g_pileup_gui = {}; // the pileup GUI object

// This is like TwoBit, but allows a controlled release of sequence data.
class FakeTwoBit extends TwoBit {
  deferred: Object;

  constructor(remoteFile: RemoteFile) {
    super(remoteFile);
    this.deferred = Q.defer();
  }

  getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<string> {
    expect(contig).to.equal('chr17');
    expect(start).to.equal(7500000);
    expect(stop).to.equal(7510000);
    return this.deferred.promise;
  }

  release(sequence: string) {
    this.deferred.resolve(sequence);
  }
}

// This is like Bam, but allows a controlled release of one batch of alignments.
class FakeBam extends Bam {
  deferred: Object;

  constructor(remoteFile: RemoteFile,
              remoteIndexFile?: RemoteFile,
              indexChunks?: Object) {
    super(remoteFile, remoteIndexFile, indexChunks);
    this.deferred = Q.defer();
  }

  getAlignmentsInRange(range: ContigInterval<string>, opt_contained?: boolean): Q.Promise<SamRead[]> {
    return this.deferred.promise;
  }

  release(alignments: SamRead[]) {
    this.deferred.resolve(alignments);
  }
}


describe('PileupTrack', function() {
  var testDiv = document.getElementById('testdiv');

  beforeEach(() => {
    // A fixed width container results in predictable x-positions for mismatches.
    testDiv.style.width = '800px';
    dataCanvas.RecordingContext.recordAll();
  });

  afterEach(() => {
    dataCanvas.RecordingContext.reset();
    // avoid pollution between tests.
    testDiv.innerHTML = '';
  });

  // Test data files
  var twoBitFile = new MappedRemoteFile(
          '/test-data/hg19.2bit.mapped',
          [[0, 16383], [691179834, 691183928], [694008946, 694011447]]),
      bamFile = new RemoteFile('/test-data/synth3.normal.17.7500000-7515000.bam'),
      bamIndexFile = new RemoteFile('/test-data/synth3.normal.17.7500000-7515000.bam.bai');

  // It simplifies the tests to have these variables available synchronously.
  var reference = '',
      alignments = [];

  before(function() {
    var twoBit = new TwoBit(twoBitFile),
        bam = new Bam(bamFile, bamIndexFile);
    return twoBit.getFeaturesInRange('chr17', 7500000, 7510000).then(seq => {
      reference = seq;
      return bam.getAlignmentsInRange(new ContigInterval('chr17', 7500734, 7500795));
    }).then(result => {
      expect(result).to.have.length.above(0);
      alignments = result;
    });
  });

  function testSetup() {
    // The fake sources allow precise control over when they give up their data.
    var fakeTwoBit = new FakeTwoBit(twoBitFile),
        fakeBam = new FakeBam(bamFile, bamIndexFile),
        referenceSource = TwoBitDataSource.createFromTwoBitFile(fakeTwoBit),
        bamSource = BamDataSource.createFromBamFile(fakeBam);

    var p = pileup.create(testDiv, {
      range: {contig: 'chr17', start: 7500734, stop: 7500795},
      tracks: [
        {
          data: referenceSource,
          viz: pileup.viz.genome(),
          isReference: true
        },
        {
          data: bamSource,
          viz: pileup.viz.pileup()
        }
      ]
    });

    return {p, fakeTwoBit, fakeBam};
  }

  var {drawnObjectsWith} = dataCanvas.RecordingContext;

  var hasReference = () => {
      // The reference initially shows "unknown" base pairs, so we have to
      // check for a specific known one to ensure that it's really loaded.
      return testDiv.querySelector('.reference canvas') &&
          drawnObjectsWith(testDiv, '.reference', x => x.letter).length > 0;
    },
    hasAlignments = () => {
      return testDiv.querySelector('.pileup canvas') &&
          drawnObjectsWith(testDiv, '.pileup', x => x.span).length > 0;
    },

    // Helpers for working with DataCanvas
    mismatchesAtPos = pos => drawnObjectsWith(testDiv, '.pileup', x => x.basePair && x.pos == pos),

    // This checks that there are 22 C/T SNVs at chr17:7,500,765
    // XXX: IGV only shows 20
    assertHasColumnOfTs = () => {
      var ref = drawnObjectsWith(testDiv, '.reference', x => x.pos == 7500765 - 1);
      expect(ref).to.have.length(1);
      expect(ref[0].letter).to.equal('C');

      var mismatches = mismatchesAtPos(7500765 - 1);
      expect(mismatches).to.have.length(22);
      _.each(mismatches, mm => {
        expect(mm.basePair).to.equal('T');
      });
      // Make sure there are no variants in the previous column, just the reference.
      expect(mismatchesAtPos(7500764 - 1).length).to.equal(0);
    };

  it('should indicate mismatches when the reference loads first', function() {
    var {p, fakeTwoBit, fakeBam} = testSetup();

    // Release the reference first.
    fakeTwoBit.release(reference);

    // Wait for the track to render, then release the alignments.
    return waitFor(hasReference, 2000).then(() => {
      fakeBam.release(alignments);
      return waitFor(hasAlignments, 2000);
    }).then(() => {
      // Some number of mismatches are expected, but it should be dramatically
      // lower than the number of total base pairs in alignments.
      var mismatches = drawnObjectsWith(testDiv, '.pileup', x => x.basePair);
      expect(mismatches).to.have.length.below(60);
      assertHasColumnOfTs();
      p.destroy();
    });
  });

  // Same as the previous test, but with the loads reversed.
  it('should indicate mismatches when the alignments load first', function() {
    var {p, fakeTwoBit, fakeBam} = testSetup();

    // Release the alignments first.
    fakeBam.release(alignments);

    // Wait for the track to render, then release the reference.
    return waitFor(hasAlignments, 2000).then(() => {
      fakeTwoBit.release(reference);
      return waitFor(hasReference, 2000);
    }).then(() => {
      var mismatches = drawnObjectsWith(testDiv, '.pileup', x => x.basePair);
      expect(mismatches).to.have.length.below(60);
      assertHasColumnOfTs();
      p.destroy();
    });
  });

  it('should sort reads', function() {
    var p = pileup.create(testDiv, {
      range: {contig: 'chr17', start: 7500734, stop: 7500796},
      tracks: [
        {
          data: pileup.formats.twoBit({
            url: '/test-data/test.2bit'
          }),
          viz: pileup.viz.genome(),
          isReference: true
        },
        {
          data: pileup.formats.bam({
            url: '/test-data/synth3.normal.17.7500000-7515000.bam',
            indexUrl: '/test-data/synth3.normal.17.7500000-7515000.bam.bai'
          }),
          viz: pileup.viz.pileup({
            viewAsPairs: false
          })
        }
      ]
    });

    return waitFor(hasAlignments, 2000).then(() => {
      var alignments = drawnObjectsWith(testDiv, '.pileup', x => x.span);
      var center = (7500796 + 7500734) / 2;
      expect(Math.floor(center)).to.equal(center);  // no rounding issues

      var rowsAndSpans = alignments.map(x => [x.row, x.span.interval]);
      var centerRows = _.uniq(
          rowsAndSpans.filter(rowIv => rowIv[1].contains(center))
                      .map(rowIv => rowIv[0]));

      // The rows with alignments overlapping the center should be the first
      // ones, e.g. 0, 1, 2, 3. Any gaps will make this comparison fail.
      expect(_.max(centerRows)).to.equal(centerRows.length - 1);

      p.destroy();
    });
  });
});
