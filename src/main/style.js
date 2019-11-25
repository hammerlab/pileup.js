/**
 * Central collection of styling settings.
 * Until we figure out a better story around canvas & CSS, they live here.
 *
 * @flow
 */

"use strict";

import DisplayMode from './viz/DisplayMode';


/**
 * Computes styles for base pairs which are rendered as letters.
  *
 * @param mode DisplayMode to render text.
 * @param fontSize font size.
 */
function TEXT_STYLE(mode: number, fontSize: number): string {

  if (mode == DisplayMode.LOOSE) {
    return  `${fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
  } else if (mode == DisplayMode.TIGHT) {
    return `bold ${fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
  } else {
    return `${fontSize}px`;
  }
}

module.exports = {
  TEXT_STYLE,
  DEFAULT_COLORPICKER: {hex: '#969696', rgb: {r: 150, g: 150, b: 150, a: 1}}, // grey in hex/rgb

  // Colors for individual base pairs
  BASE_COLORS: {
    'A': '#188712',
    'G': '#C45C16',
    'C': '#0600F9',
    'T': '#F70016',
    'U': '#F70016',
    'N': 'black'
  },


  // Gene track
  GENE_ARROW_SIZE: 4,
  GENE_COLOR: 'blue',  // color of the gene line, exons, text, etc.
  GENE_COMPLEMENT_COLOR: 'white',  // a color visible on top of GENE_COLOR
  GENE_FONT: `'Helvetica Neue', Helvetica, Arial, sans-serif`,
  GENE_FONT_SIZE: 16,
  GENE_TEXT_PADDING: 5,  // space between bottom of coding exon & top of gene name

  // Pileup track
  ALIGNMENT_COLOR: '#c8c8c8',
  ALIGNMENT_MINUS_STRAND_COLOR: 'rgb(176, 176, 236)',
  ALIGNMENT_PLUS_STRAND_COLOR: 'rgb(236, 176, 176)',
  DELETE_COLOR: 'black',
  INSERT_COLOR: 'rgb(97, 0, 216)',
  READ_SPACING: 2, // vertical spacing between reads
  READ_HEIGHT: 13, // Height of read

  // Idiogram track
  IDIOGRAM_LINEWIDTH: 1,


  // Coverage track
  COVERAGE_FONT_STYLE: `bold 9px 'Helvetica Neue', Helvetica, Arial, sans-serif`,
  COVERAGE_FONT_COLOR: 'black',
  COVERAGE_TICK_LENGTH: 5,
  COVERAGE_TEXT_PADDING: 3,  // space between axis ticks and text
  COVERAGE_TEXT_Y_OFFSET: 3,  // so that ticks and texts align better
  COVERAGE_BIN_COLOR: '#a0a0a0',
  COVERAGE_MIN_BAR_WIDTH_FOR_GAP: 8,  // show a 1px gap between bars at this resolution

  // Scale Track
  SCALE_LINE_PADDING: 40,  // space between mid point and left/right lines
  SCALE_FONT_STYLE: `bold 12px 'Helvetica Neue', Helvetica, Arial, sans-serif`,
  SCALE_TEXT_Y_OFFSET: 5,  // so that lines and the text align better
  SCALE_FONT_COLOR: 'black',
  SCALE_ARROW_SIZE: 4,

  // Location track
  LOC_TEXT_PADDING: 5,  // space between mid-point label and tick
  LOC_TICK_LENGTH: 10,
  LOC_TEXT_Y_OFFSET: 5,  // so that the line and the text align better
  LOC_FONT_STYLE: `13px 'Helvetica Neue', Helvetica, Arial, sans-serif`,
  LOC_FONT_COLOR: 'black',

  // Variant Track
  VARIANT_STROKE: 'blue',
  VARIANT_FILL: '#ddd',
  VARIANT_HEIGHT: 14,

  // Genotype Track
  GENOTYPE_SPACING: 1,
  GENOTYPE_HEIGHT: 10,
  GENOTYPE_FILL_HET: '#0015ff',
  GENOTYPE_FILL_HOM: '#00f1f9',
  BACKGROUND_FILL: '#f2f2f2',

};
