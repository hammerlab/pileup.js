'use strict';

module.exports = function(grunt) {
  grunt.initConfig({
    flow: {
      app: {
        src: '.',
        options: {
          background: true
        }
      }
    },
    watch: {
      flow: {
        files: ['src/**/*.js', 'test/**/*.js'],
        tasks: ['flow:app:status']
      }
    },
    browserify: {
      dist: {
        files: {
          'build/all.js': ['src/**/*.js']
        },
      },
      test: {
        files: {
          'build/tests.js': ['test/**/*-test.js']
        },
      },
      options: {
        transform: [
          [
            "reactify",
            {
              harmony: true,
              stripTypes: true
            }
          ]
        ],
        browserifyOptions: {
          debug: true  // generate a source map
        }
      }
    },
    mocha_phantomjs: {
      all: ['test/**/*.html']
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-flow-type-check');
  grunt.loadNpmTasks('grunt-mocha-phantomjs');

  grunt.registerTask('watchFlow', ['flow:app:start', 'watch']);
  grunt.registerTask('prod', ['flow:app', 'browserify:dist']);
  grunt.registerTask('browsertests', ['flow:app', 'browserify:test']);
  grunt.registerTask('test', ['browsertests', 'mocha_phantomjs']);
};
