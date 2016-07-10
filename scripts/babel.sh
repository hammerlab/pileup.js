#!/usr/bin/env bash

if [ $# -eq 0 ]; then
    babel src --retain-lines --ignore src/lib --out-dir dist
else
    for f in "$@"; do
      node_modules/.bin/babel "$f" --retain-lines -o dist/"${f#src/}"
    done
fi