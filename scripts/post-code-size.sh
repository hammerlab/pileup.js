#!/bin/bash
set -o errexit
curl -O https://raw.githubusercontent.com/danvk/travis-weigh-in/v1.0/weigh_in.py

python weigh_in.py dist/pileup.min.js
