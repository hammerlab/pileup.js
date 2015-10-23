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
import re
import sys
import json
import urllib2

TRAVIS_COMMIT = os.environ['TRAVIS_COMMIT']
TRAVIS_PULL_REQUEST = os.environ.get('TRAVIS_PULL_REQUEST')
TRAVIS_REPO_SLUG = os.environ['TRAVIS_REPO_SLUG']
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')

if TRAVIS_PULL_REQUEST == 'false':
    TRAVIS_PULL_REQUEST = False

# The PR job has all the needed info to compute deltas.
# But GitHub shows statuses for the commit associated with the push job.
# For the PR job, this will be the status URL for the push job.
TRAVIS_STATUS_URL = None


def raise_for_status(url, response):
    if response.getcode() < 200 or response.getcode() >= 300:
        sys.stderr.write(response.read())
        sys.stderr.write('\n')
        raise Exception('Request for %s failed: %s' % (url, response.getcode()))


def post_status(url, state, context, description):
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
    headers = {'Authorization': 'token ' + GITHUB_TOKEN}
    request = urllib2.Request(url, None, headers)
    r = urllib2.urlopen(request)
    raise_for_status(url, r)

    data = json.loads(r.read())
    for status in data:
        if status['context'] == context:
            return status['description']
    return None


def get_pr_info(slug, pull_number):
    url = 'https://api.github.com/repos/%s/pulls/%s' % (slug, pull_number)
    headers = {'Authorization': 'token ' + GITHUB_TOKEN}
    request = urllib2.Request(url, None, headers)
    r = urllib2.urlopen(request)
    raise_for_status(url, r)
    return json.loads(r.read())


def get_base_size(filename):
    global TRAVIS_STATUS_URL
    print 'TRAVIS_PULL_REQUEST: %s' % TRAVIS_PULL_REQUEST
    if not TRAVIS_PULL_REQUEST:
        return None
    pr = get_pr_info(TRAVIS_REPO_SLUG, TRAVIS_PULL_REQUEST)
    print json.dumps(pr, indent=2)
    sha = pr['base']['sha']
    url = pr['base']['repo']['statuses_url'].replace('{sha}', sha)
    TRAVIS_STATUS_URL = pr['statuses_url']
    print 'base sha %s' % sha
    print 'statuses url %s' % url
    assert sha in url, 'statuses_url %s missing "{sha}"' % url
    status = get_status(url, filename)
    if not status:
        print 'Unable to find status %s for base at %s' % (filename, url)
        return None
    return parse_description(status)


def format_description(current_size, previous_size):
    if previous_size:
        delta = current_size - previous_size
        if delta == 0:
            return 'No change ({:,.0f} bytes)'.format(current_size)
        pct = 100.0 * delta / current_size
        return '{:+,.0f} bytes ({:+0.2f}%) --> {:,.0f} bytes'.format(
                delta, pct, current_size)
    return '{:,d} bytes'.format(current_size)


def parse_description(description):
    m = re.search(r'([0-9,]+) bytes\)?$', description)
    assert m, 'Unable to parse "%s"' % description
    return int(m.group(1).replace(',', '').replace(' bytes', ''))


def test_inverses():
    """format_description and parse_description must be inverses."""
    # TODO: move this into a test module
    vals = [
        (123456, 122456),
        (123456, None),
        (123456, 123456),
        (122456, 123456),
        (12345678, 12345679)
    ]
    for current_size, prev_size in vals:
        desc = format_description(current_size, prev_size)
        back_size = parse_description(desc)
        assert back_size == current_size, (desc, back_size)


if __name__ == '__main__':
    test_inverses()
    if len(sys.argv) != 2:
        sys.stderr.write('Usage: %s path/to/file\n' % sys.argv[0])
        sys.exit(1)
    filename = sys.argv[1]

    if not GITHUB_TOKEN:
        sys.stderr.write('The GITHUB_TOKEN environment variable must be set.\n')
        sys.exit(1)

    if not os.environ.get('TRAVIS'):
        print 'Not Travis; exiting'
        sys.exit(0)

    current_size = os.stat(filename).st_size
    previous_size = get_base_size(filename)

    print 'Current: %s' % current_size
    print 'Previous: %s' % previous_size

    if TRAVIS_STATUS_URL:
        url = TRAVIS_STATUS_URL
    else:
        url = 'https://api.github.com/repos/%s/statuses/%s' % (TRAVIS_REPO_SLUG, TRAVIS_COMMIT)

    print 'POSTing to %s' % url
    post_status(url, 'success', filename, format_description(current_size, previous_size))
