'use strict';

module.exports = function (grunt) {
  grunt.initConfig({
  
    typescript: {
      app: {
        src: ['src/**/*.ts'],
        dest: 'build',
        options: {
          module: 'commonjs',
          sourcemap: true,
          declaration: true
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
          require: 'node_modules/qajax/build/qajax.min.js',
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

    browserify: {
      client: {
        src: 'build/src/main.js',
        dest: 'build/all.js'
      }
    },

    watch: {
      files: ['<%= typescript.app.src %>',
              '<%= typescript.test.src %>'],
      tasks: ['typescript', 'browserify']
    }
  });
    
  grunt.loadNpmTasks('grunt-typescript');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('_runTests', ['mochaTest']);
  grunt.registerTask('test', ['typescript', '_runTests']);

  grunt.registerTask('prod', ['typescript', 'browserify']);
  
  grunt.registerTask('default', ['test']);
};
