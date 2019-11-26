/* @flow */
'use strict';

import {expect} from 'chai';

import {CytoBandFile} from '../../main/data/cytoBand';
import ContigInterval from '../../main/ContigInterval';
import RemoteFile from '../../main/RemoteFile';

describe('CytoBand', function() {
  var remoteFile = new RemoteFile('/test-data/cytoBand.txt.gz');

  it('should get chromosomes from cytoband file', function(): any {
    var cytoBand = new CytoBandFile(remoteFile);
    var range = new ContigInterval('chr20', 63799, 69094);

    return cytoBand.getFeaturesInRange(range).then(chr => {
      expect(chr.name).to.equal('chr20');
      expect(chr.position.start()).to.equal(0);
      expect(chr.position.stop()).to.equal(63025520);
      expect(chr.bands).to.have.length(20);
      expect(chr.bands[0].name).to.equal('p13');
      expect(chr.bands[0].value).to.equal('gneg');
    });
  });
});
