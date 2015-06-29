'use strict';

module.exports = function(grunt) {
  grunt.initConfig({
    jscoverage: {
      src: {
        expand: true,
        cwd: 'dist/',
        src: ['tests.js'],
        dest: 'dist/cov/',
        ext: '.js'
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
          output: 'dist/bundled.lcov',
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

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-mocha-phantomjs');
  grunt.loadNpmTasks("grunt-jscoverage");

  grunt.registerTask('test', ['connect', 'mocha_phantomjs:run']);
  grunt.registerTask('coverage',
                     ['jscoverage', 'connect', 'mocha_phantomjs:cov']);
};
