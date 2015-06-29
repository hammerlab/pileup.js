#!/bin/bash
# Transform all the code from src to dist

jstransform --react --harmony --strip-types \
  --non-strict-es6module --source-map-inline \
  $@ \
  src/ dist/
