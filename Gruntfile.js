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
          'build/all.min.js': ['build/all.js']
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
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-flow-type-check');
  grunt.loadNpmTasks('grunt-mocha-phantomjs');
  grunt.loadNpmTasks("grunt-jscoverage");
  grunt.loadNpmTasks("grunt-exorcise");
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('watchFlow', ['flow:app:start', 'watch:flow']);
  grunt.registerTask('prod', ['browserify:dist', 'uglify:dist']);
  grunt.registerTask('browsertests', ['browserify:test']);
  grunt.registerTask('test', ['browsertests', 'connect', 'mocha_phantomjs:run']);
  grunt.registerTask('travis', ['flow', 'test']);
  grunt.registerTask('coverage',
                     ['browsertests', 'exorcise:bundle', 'jscoverage', 'connect', 'mocha_phantomjs:cov']);
};
