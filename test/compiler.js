// From http://www.hammerlab.org/2015/02/14/testing-react-web-apps-with-mocha/#jsx-transpilation
var fs = require('fs'),
    ReactTools = require('react-tools'),
    origJs = require.extensions['.js'];

require.extensions['.js'] = function(module, filename) {
  // optimization: external code never needs compilation.
  if (filename.indexOf('node_modules/') >= 0) {
    return (origJs || require.extensions['.js'])(module, filename);
  }
  var content = fs.readFileSync(filename, 'utf8');
  var compiled = ReactTools.transform(content, {harmony: true, stripTypes: true});
  return module._compile(compiled, filename);
};
