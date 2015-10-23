#!/usr/bin/env python
"""Track changes in the size of a file using Travis-CI and GitHub statuses.

Usage:
    post_code_size.py path/to/file

This should be run inside of a Travis-CI worker.
It will post the current size of the file as a GitHub status on the commit.

If it's able to deduce the size of the file before the change, it will report
the size delta. This requires that this script was run on the base for a Pull
Request, e.g. the commit that was merged into master.
"""

import os
import sys
import json
import urllib2

if not os.environ.get('TRAVIS'):
    print 'Not Travis; exiting'
    sys.exit(0)

TRAVIS_COMMIT = os.environ['TRAVIS_COMMIT']
TRAVIS_PULL_REQUEST = os.environ.get('TRAVIS_PULL_REQUEST')
TRAVIS_REPO_SLUG = os.environ['TRAVIS_REPO_SLUG']
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')

if not GITHUB_TOKEN:
    sys.stderr.write('The GITHUB_TOKEN environment variable must be set.\n')
    sys.exit(1)


def raise_for_status(url, response):
    if response.getcode() < 200 or response.getcode() >= 300:
        sys.stderr.write(response.read())
        sys.stderr.write('\n')
        raise Exception('Request for %s failed: %s' % (url, response.getcode()))


def post_status(slug, sha, state, context, description):
    url = 'https://api.github.com/repos/%s/statuses/%s' % (slug, sha)
    data = {
        'state': state,
        'context': context,
        'description': description
    }
    headers = {'Authorization': 'token ' + GITHUB_TOKEN}

    request = urllib2.Request(url, json.dumps(data), headers)
    r = urllib2.urlopen(request)
    raise_for_status(url, r)

    print 'Posted %s' % json.dumps(data)


def get_status(url, context):
    url = 'https://api.github.com/repos/%s/statuses/%s' % (slug, sha)
    headers = {'Authorization': 'token ' + GITHUB_TOKEN}
    request = urllib2.Request(url, None, headers)
    r = urllib2.urlopen(request)
    raise_for_status(url, r)

    data = json.loads(r.read())
    for status in data:
        if status['context'] == context:
            return status['description']


def get_pr_info(slug, pull_number):
    url = 'https://api.github.com/repos/%s/pulls/%s' % (slug, pull_number)
    headers = {'Authorization': 'token ' + GITHUB_TOKEN}
    request = urllib2.Request(url, None, headers)
    r = urllib2.urlopen(request)
    raise_for_status(url, r)
    return json.loads(r.read())


def get_base_size(filename):
    if not TRAVIS_PULL_REQUEST:
        return None
    pr = get_pr_info(TRAVIS_REPO_SLUG, TRAVIS_PULL_REQUEST)
    sha = pr['base']['sha']
    url = pr['base']['repo']['statuses_url'].replace('{sha}', sha)
    assert sha in url, 'statuses_url %s missing "{sha}"' % url
    return parse_description(get_status(url, filename))


def format_description(size):
    return '{:,d} bytes'.format(size)


def parse_description(description):
    return int(description.replace(',', '').replace(' bytes', ''))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.stderr.write('Usage: %s path/to/file\n' % sys.argv[0])
        sys.exit(1)
    filename = sys.argv[1]

    current_size = os.stat(filename).st_size

    post_status(TRAVIS_REPO_SLUG, TRAVIS_COMMIT, 'success', filename, format_description(current_size))


    # TODO: if this is a PR, determine the code size at its base ref by fetching the status
