#!/usr/bin/env python
'''
This script generates mapped files for use with test/MappedRemotedFile.js.

Usage:

    $ cat <END http://path/to/file.txt
    [[0, 1234], [5678, 6789]]
    END
    ...
    Wrote file.mapped.txt
    Use with:
    new MappedRemoteFile('file.mapped.txt', [
        [0, 1234],
        [5678, 6789]
    ]);

'''

import fileinput
import json
import os
import requests
import urlparse
import sys

_, url = sys.argv

ranges = json.load(sys.stdin)
ranges.sort(key=lambda x: x[0])

# TODO: coalesce ranges instead of failing
for r1, r2 in zip(ranges[:-1], ranges[1:]):
    assert r1[1] < r2[0]

outfile = os.path.basename(urlparse.urlparse(url).path) + '.mapped'

with open(outfile, 'wb') as out:
    total_bytes = 0
    for start, stop in ranges:
        headers = {'Range': 'bytes=%s-%s' % (start, stop)}
        result = requests.get(url, headers=headers).content
        total_bytes += len(result)
        out.write(result)

print '''Wrote %d bytes to %s

Use with:
    new MappedRemoteFile('%s', %s)
''' % (total_bytes, outfile, outfile, json.dumps(ranges))
