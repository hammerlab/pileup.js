/**
 * fake TwoBit file.
 * Used to query regions that extend the bounds in
 * the test twobit files.
 *
 * @flow
 */
import Q from 'q';
import TwoBit from '../main/data/TwoBit';
import RemoteFile from '../main/RemoteFile';


class FakeTwoBit extends TwoBit {
  deferred: Object;

  constructor(remoteFile: RemoteFile) {
    super(remoteFile);
    this.deferred = Q.defer();
  }

  getFeaturesInRange(contig: string, start: number, stop: number): Q.Promise<string> {
    return this.deferred.promise;
  }

  release(sequence: string) {
    this.deferred.resolve(sequence);
  }
}

module.exports = {
  FakeTwoBit
};
