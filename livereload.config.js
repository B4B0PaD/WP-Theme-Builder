const path = require('path');
const livereload = require('livereload');

const base_path = path.join(__dirname, '..', '..');
const content_path = path.join(base_path, 'Content');

var options = {
  exts: ['js', 'css', 'jpg', 'jpeg', 'png', 'svg'],
  applyCSSLive: true,
  applyJSLive: false,
  applyImgLive: false,
  port: 35729
};

var server = livereload.createServer(options);

server.watch([
  path.resolve(content_path, 'Scripts'),
  path.resolve(content_path, 'Styles')
]);
