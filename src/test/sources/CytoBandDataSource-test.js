/* @flow */
'use strict';

import {expect} from 'chai';

import CytoBandDataSource from '../../main/sources/CytoBandDataSource';
import {CytoBandFile} from '../../main/data/cytoBand';
import RemoteFile from '../../main/RemoteFile';
import ContigInterval from '../../main/ContigInterval';

describe('CytoBandDataSource', function() {
  function getTestSource () {
    // cytoband file downloaded from
    // http://hgdownload.cse.ucsc.edu/goldenpath/hg19/database/cytoBand.txt.gz
    var f = new CytoBandFile(new RemoteFile('/test-data/cytoBand.txt.gz'));
    return CytoBandDataSource.createFromCytoBandFile(f);
  }

  it('should fetch chromsome', function(done) {
    var source = getTestSource();
    var range = new ContigInterval('chr22',0,3);
    // Before data has been fetched, all base pairs are null.
    expect(source.getFeaturesInRange(range)).to.deep.equal([undefined]);

    source.on('newdata', () => {
      var chr = source.getFeaturesInRange(range)[0];
      expect(chr.name).to.equal('chr22');
      expect(chr.bands).to.have.length(16);
      expect(chr.bands[0].name).to.equal('p13');
      expect(chr.bands[0].value).to.equal('gvar');
      done();
    });
    source.rangeChanged({contig: range.contig, start: range.start(), stop: range.stop()});
  });

  it('should allow a mix of chr and non-chr', function(done) {
    var source = getTestSource();
    var chrRange = {contig: 'chr1', start: 0, stop: 3};

    var range = new ContigInterval('1',0,3);

    source.on('newdata', () => {
      var chr = source.getFeaturesInRange(range)[0];
      expect(chr.name).to.equal('chr1');
      expect(chr.bands).to.have.length(63);
      expect(chr.bands[0].name).to.equal('p36.33');
      expect(chr.bands[0].value).to.equal('gneg');
      done();
    });
    source.rangeChanged(chrRange);
  });
});
