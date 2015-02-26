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
          'build/tests.js': ['src/**/*.js', 'test/**/*-test.js', '!src/main.js']
        }
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
    jscoverage: {
      src: {
        expand: true,
        cwd: 'build/',
        src: ['tests.js'],
        dest: 'build/cov/',
        ext: '.js'
      }
    },
    exorcise: {
      bundle: {
        options: {},
        files: {
          'build/tests.map': ['build/tests.js'],  // externalize source map
        }
      }
    },
    mocha_phantomjs: {
      run: {
        src: ['test/runner.html']
      },
      cov: {
        src: ['test/coverage.html'],
        options: {
          reporter: 'node_modules/mocha-lcov-reporter/lib/lcov.js',
          output: 'build/bundled.lcov'
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-flow-type-check');
  grunt.loadNpmTasks('grunt-mocha-phantomjs');
  grunt.loadNpmTasks("grunt-jscoverage");
  grunt.loadNpmTasks("grunt-exorcise");

  grunt.registerTask('watchFlow', ['flow:app:start', 'watch:flow']);
  grunt.registerTask('watchFlowProd', ['flow:app:start', 'watch:flowProd']);
  grunt.registerTask('prod', ['browserify:dist']);
  grunt.registerTask('browsertests', ['browserify:test']);
  grunt.registerTask('test', ['browsertests', 'mocha_phantomjs:run']);
  grunt.registerTask('travis', ['flow', 'test']);
  grunt.registerTask('coverage',
                     ['browsertests', 'exorcise', 'jscoverage', 'mocha_phantomjs:cov']);
};
