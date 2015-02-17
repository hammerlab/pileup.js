'use strict';

module.exports = function (grunt) {
  grunt.initConfig({
  
    typescript: {
      app: {
        src: ['src/**/*.ts'],
        dest: 'build',
        options: {
          module: 'commonjs',
          sourcemap: true
        }
      },

      test: {
        src: ['test/**/*.ts'],
        dest: 'build',
        options: {
          module: 'commonjs',
          sourcemap: true
        }
      }
    },

    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          // require: 'config/coverage_blanket',
          quiet: false
        },
        src: ['build/test/**/*.js']
      },
      coverage: {
        options: {
          reporter: 'html-cov',
          quiet: true,
          captureFile: 'build/coverage.html'
        },
        src: ['build/test/**/*.js']
      },
      // 'travis-cov': {
      //   options: {
      //     reporter: 'travis-cov'
      //   },
      //   src: ['test/**/*.js']
      // }
    },
  });
    
  grunt.loadNpmTasks('grunt-typescript');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.registerTask('_runTests', ['mochaTest']);
  grunt.registerTask('test', ['typescript', '_runTests']);
  
  grunt.registerTask('default', ['test']);
};
