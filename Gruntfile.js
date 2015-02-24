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
        files: [
          'src/**/*.js',
          'test/**/*.js',
          'lib/**/*.js',
          'types/**/*.js'
        ],
        tasks: ['flow:app:status']
      },
      flowProd: {
        files: ['<%= watch.flow.files %>'],
        tasks: ['flow:app:status', 'prod']
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

  grunt.registerTask('watchFlow', ['flow:app:start', 'watch:flow']);
  grunt.registerTask('watchFlowProd', ['flow:app:start', 'watch:flowProd']);
  grunt.registerTask('prod', ['browserify:dist']);
  grunt.registerTask('browsertests', ['browserify:test']);
  grunt.registerTask('test', ['browsertests', 'mocha_phantomjs']);
};
