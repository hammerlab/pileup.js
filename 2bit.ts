/// <reference path="typings/q/q.d.ts" />
/// <reference path="xhr.ts" />

interface DataSource {
  fetchRange(contig: string, start: number, stop: number): void;
  getFeaturesInRange(contig: string, start: number, stop: number): Array<any>;
}


var TWO_BIT_MAGIC = 0x1A412743;


class TwoBit implements DataSource {
  constructor(private url: string) {
    fetchByteRange(url, 0, 1023).then(function(response) {
      var u32 = new Uint32Array(response.buffer);
      if (u32[0] != TWO_BIT_MAGIC) {
        console.error('Invalid magic: ', u32[0]);
      } else {
        console.log('Valid 2bit file');
      }
    });
  }

  fetchRange(contig: string, start: number, stop: number): void {
  //  var promise = Qajax(this.url)
  //      .then(Qajax.filterSuccess)
  //      .get("responseText")  // using a cool Q feature here
  //      .then(function (txt) {
  //        console.log("server returned: ", txt);
  //      }, function (err) {
  //        console.log("xhr failure: ", err);
  //      });
  }

  getFeaturesInRange(contig: string, start: number, stop: number): Array<Object> {
    return [];
  }
}
