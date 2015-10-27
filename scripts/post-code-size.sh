#!/bin/bash
set -o errexit
curl -O https://raw.githubusercontent.com/danvk/travis-weigh-in/master/weigh_in.py

python weigh_in.py dist/pileup.min.js
