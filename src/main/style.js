/**
 * Central collection of styling settings.
 * Until we figure out a better story around canvas & CSS, they live here.
 *
 * @flow
 */

var BASE_COLORS = {
  'A': '#188712',
  'G': '#C45C16',
  'C': '#0600F9',
  'T': '#F70016',
  'U': '#F70016',
  'N': 'black'
};

// Styles for base pairs which are rendered as letters
var LOOSE_TEXT_STYLE = '24px Helvetica Neue, Helvetica, Arial, sans-serif';
var TIGHT_TEXT_STYLE = 'bold 12px Helvetica Neue, Helvetica, Arial, sans-serif';

// Gene track
var GENE_ARROW_SIZE = 4;
var GENE_COLOR = 'blue';  // color of the gene line, exons, text, etc.
var GENE_COMPLEMENT_COLOR = 'white';  // a color visible on top of GENE_COLOR
var GENE_FONT = `'Helvetica Neue', Helvetica, Arial, sans-serif`;
var GENE_FONT_SIZE = 16;
var GENE_TEXT_PADDING = 5;  // space between bottom of coding exon & top of gene name

// Pileup track
var ALIGNMENT_COLOR = '#c8c8c8';
var DELETE_COLOR = 'black';
var INSERT_COLOR = 'rgb(97, 0, 216)';


module.exports = {
  BASE_COLORS,
  LOOSE_TEXT_STYLE,
  TIGHT_TEXT_STYLE,
  GENE_ARROW_SIZE,
  GENE_COLOR,
  GENE_COMPLEMENT_COLOR,
  GENE_FONT,
  GENE_FONT_SIZE,
  GENE_TEXT_PADDING,
  ALIGNMENT_COLOR,
  DELETE_COLOR,
  INSERT_COLOR
};
