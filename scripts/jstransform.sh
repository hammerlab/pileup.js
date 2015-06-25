#!/bin/bash

export JSTRANSFORM_OPTS="${JSTRANSFORM_OPTS} --react --harmony --strip-types --non-strict-es6module --source-map-inline"

# Transform all the code from src to build
jstransform $JSTRANSFORM_OPTS src build/
