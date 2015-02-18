'use strict';

module.exports = function (grunt) {
  grunt.initConfig({
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
