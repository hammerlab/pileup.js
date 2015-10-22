#!/bin/bash
cat coverage/lcov.info | ./node_modules/.bin/coveralls

# size=$(wc -c < dist/pileup.min.js | sed 's/ //g')
# echo "Code size: $size"
# curl --header "Authorization: token $GITHUB_TOKEN" --data '{"state": "success", "description": "'$size' bytes", "context": "Minified Code Size" }' https://api.github.com/repos/$TRAVIS_REPO_SLUG/statuses/$TRAVIS_COMMIT

./scripts/post_code_size.py dist/pileup.min.js

echo ''  # reset exit code -- failure to post coverage shouldn't be an error.
