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
    browserify: {
      test: {
        files: {
          'build/tests.browser.js': ['build/main/**/*.js', 'build/test/**/*-test.js']
        }
      },
      watchDist: {
        files: {
          'build/pileup.browser.js': ['build/main/**/*.js']
        },
        options: {
          watch: true,
          keepAlive: true,
          require: ['./build/main/pileup.js:pileup']
        }
      },
      watchTest: {
        files: '<%= browserify.test.files %>',
        options: {
          watch: true,
          keepAlive: true,
        }
      },
      options: {
        browserifyOptions: {
          debug: true  // generate a source map
        }
      }
    },
    uglify: {
      dist: {
        files: {
          'build/pileup.browser.min.js': ['build/pileup.browser.js']
        }
      }
    },
    jscoverage: {
      src: {
        expand: true,
        cwd: 'build/',
        src: ['tests.browser.js'],
        dest: 'build/cov/',
        ext: '.js'
      }
    },
    exorcise: {
      bundle: {
        options: {},
        files: {
          'build/tests.browser.map': ['build/tests.browser.js'],  // externalize source map
        }
      }
    },
    mocha_phantomjs: {
      run: {
        options: {
          urls: ['http://localhost:9501/src/test/runner.html']
        }
      },
      cov: {
        options: {
          urls: ['http://localhost:9501/src/test/coverage.html'],
          reporter: 'node_modules/mocha-lcov-reporter/lib/lcov.js',
          output: 'build/bundled.lcov',
          silent: true
        }
      }
    },
    connect: {
      server: {
        options: {
          port: 9501
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-flow-type-check');
  grunt.loadNpmTasks('grunt-mocha-phantomjs');
  grunt.loadNpmTasks("grunt-jscoverage");
  grunt.loadNpmTasks("grunt-exorcise");
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('test', ['browserify:test', 'connect', 'mocha_phantomjs:run']);
  grunt.registerTask('travis', ['flow', 'test']);
  grunt.registerTask('coverage',
                     ['browserify:test', 'exorcise:bundle', 'jscoverage', 'connect', 'mocha_phantomjs:cov']);
};
