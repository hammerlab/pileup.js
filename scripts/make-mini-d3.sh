#!/bin/bash
# This is a custom build of D3.
# See https://github.com/hammerlab/pileup.js/issues/275

# The unicode replacements are a workaround for
# https://github.com/facebook/flow/issues/521

mkdir -p src/lib
smash \
    node_modules/d3/src/start.js \
    node_modules/d3/src/behavior/drag.js \
    node_modules/d3/src/end.js \
    | perl -pe 's/ε/EPSILON/g' \
    | perl -pe 's/π/PI/g' \
    | perl -pe 's/τ/TAU/g' \
    > src/lib/minid3.js
