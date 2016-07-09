#!/usr/bin/env bash

for f in "$@"; do
  node_modules/.bin/babel "$f" --retain-lines -o dist/"${f#src/}"
done
