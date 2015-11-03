#!/bin/bash
set -o errexit

python node_modules/travis-weigh-in/weigh_in.py dist/pileup.min.js

