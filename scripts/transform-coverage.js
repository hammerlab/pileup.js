#!/usr/bin/env node
/**
 * This script applies a source map to LCOV data. If you have coverage data for
 * a concatenated file, plus a source map, this will output LCOV data for your
 * original source files.
 *
 * Usage:
 *
 *   transform-coverage.js path/to/soure.map path/to/coverage.lcov > out.lcov
 */

var sourcemap = require('source-map');
var fs = require('fs');
var parseDataUri = require('parse-data-uri')
var lcovParse = require('lcov-parse');
var assert = require('assert');

var sourcemapfile = process.argv[2];
var lcovfile = process.argv[3];

var sourcemap_data = fs.readFileSync(sourcemapfile).toString();
var sourcemap_consumer = new sourcemap.SourceMapConsumer(sourcemap_data);

var SOURCE = 'src/';

lcovParse(lcovfile, function(err, data) {
  assert(!err);
  // TODO: 0 --> the correct file
  var lines = data[0].lines.details;

  var fileToCov = {};  // filename -> { line num -> hits }

  lines.forEach(function(line) {
    var num = line.line, hits = line.hit;
    var original_position = sourcemap_consumer.originalPositionFor({ line: num, column: 0 });
    if (original_position == null) {
      return;
    }

    original_filename = original_position.source;
    original_num = original_position.line;

    if (!original_filename || original_filename.indexOf('node_modules') >= 0) {
      return;
    }

    var base = original_filename.indexOf(SOURCE);
    if (base == -1) return;
    original_filename = original_filename.slice(base);

    if (!fileToCov[original_filename]) fileToCov[original_filename] = [];
    fileToCov[original_filename][original_num] = hits;
  });

  // Convert to LCOV format
  for (var filename in fileToCov) {
    var cov = fileToCov[filename]
    console.log('SF:' + filename);
    for (var i = 0; i < cov.length; i++) {
      if (cov[i] != null) {
        console.log('DA:' + i + ',' + cov[i]);
      }
    }
    console.log('end_of_record');
  }
});
