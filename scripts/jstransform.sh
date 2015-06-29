#!/bin/bash

export JSTRANSFORM_OPTS="${JSTRANSFORM_OPTS} --react --harmony --strip-types --non-strict-es6module --source-map-inline"
echo "$JSTRANSFORM_OPTS"
# Transform all the code from src to dist
jstransform $JSTRANSFORM_OPTS src dist/
