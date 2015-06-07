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
      dist: {
        files: {
          'build/pileup.js': ['src/**/*.js']
        },
      },
      test: {
        files: {
          'build/tests.js': ['src/**/*.js', 'test/**/*-test.js']
        }
      },
      watchDist: {
        files: '<%= browserify.dist.files %>',
        options: {
          watch: true,
          keepAlive: true,
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
        require: [ './src/pileup.js:pileup' ],
        transform: [
          [
            "jstransformify",
            {
              react: true,
              harmony: true,
              stripTypes: true,
              nonStrictEs6module: true
            }
          ]
        ],
        browserifyOptions: {
          debug: true  // generate a source map
        }
      }
    },
    uglify: {
      dist: {
        files: {
          'build/pileup.min.js': ['build/pileup.js']
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
        options: {
          urls: ['http://localhost:9501/test/runner.html']
        }
      },
      cov: {
        options: {
          urls: ['http://localhost:9501/test/coverage.html'],
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

  grunt.registerTask('prod', ['browserify:dist', 'uglify:dist']);
  grunt.registerTask('test', ['browserify:test', 'connect', 'mocha_phantomjs:run']);
  grunt.registerTask('travis', ['flow', 'test']);
  grunt.registerTask('coverage',
                     ['browserify:test', 'exorcise:bundle', 'jscoverage', 'connect', 'mocha_phantomjs:cov']);
};
