/* eslint-disable */
// ==========================
// COMPONENTS
// ==========================
var path = require('path');
var gulp = require('gulp');
var named = require('vinyl-named-with-path');
var webpackStream = require('webpack-stream');
var argv = require('yargs').argv;
var gulpsync = require('gulp-sync')(gulp);
var postcss = require('gulp-postcss');
var cached = require('gulp-cached');
var sass = require('gulp-sass');
var sassImage = require('gulp-sass-image');
var sourcemaps = require('gulp-sourcemaps');
var progeny = require('gulp-progeny');
var fs = require('fs');
var globby = require('globby');
var sassLint = require('gulp-sass-lint');
var eslint = require('gulp-eslint');
var notify = require('gulp-notify');
var webpack = require('webpack');
var include = require('gulp-include')
var {phpMinify} = require('@cedx/gulp-php-minify');

var style_notification_flag = false;
var script_notification_flag = false;

// ==========================
// POST-CSS PLUGINS
// ==========================
var cssnano = require('cssnano');

var processors = [
  cssnano({
    zindex: false,
    autoprefixer: {
      browsers: ['last 2 versions'],
      add: true
    }
  })
];

// ==========================
// PATHS
// ==========================
var THEME_NAME = 'test';

var base_path = __dirname;

var develop_path = path.join(base_path, '_develop');
var build_path = path.join(base_path, '_build', THEME_NAME);
var tmp_files_path = path.join(base_path, '.tmp');

var dev_script_path = path.join(develop_path, '_script');
var dev_style_path = path.join(develop_path, '_style');
var dev_image_path = path.join(develop_path, '_image');
var dev_php_path = path.join(develop_path, '_php');

var build_script_path = path.join(build_path, '_script');
var build_style_path = path.join(build_path, '_style');
var build_image_path = path.join(build_path, '_image');
var build_php_path = path.join(build_path, '_php');

var dev_script_scope_path = path.join(dev_script_path, '_scope');
var dev_style_scope_path = path.join(dev_style_path, '_scope');

// ==========================
// DEV TASKS - BASE
// ==========================
gulp.task('build', gulpsync.async(['build_js', 'build_style', 'build_structure']));

/* ========== JS ========== */

gulp.task('build_js', gulpsync.sync(['webpack_js']));
gulp.task('webpack_js', buildJS);
gulp.task('lint_js', lintJS);

/* ========== SASS ========== */

gulp.task('build_style', gulpsync.sync(['sass-image', 'build_scss']));
gulp.task('build_scss', buildStyle);
gulp.task('update_style', updateStyle);
gulp.task('lint_style', lintStyle);
gulp.task('sass-image', generateImageHelper);

/* ========== PHP ========== */

gulp.task('build_structure', gulpsync.sync(['build_php', 'minify_php']));
gulp.task('build_php', buildPhp);
gulp.task('minify_php', minifyPhp);

/* ==================== */

gulp.task('watch', [
  'sass-image',
  'watch_eslint_js',
  'watch_dev_style',
  'watch_dev_structure',
  'notify_style_build',
  'notify_js_build'
], () => {
  setTimeout(() => {
    style_notification_flag = true;
  }, 1);
  setTimeout(() => {
    script_notification_flag = true;
  }, 30000);
});

gulp.task('watch_dev_structure', () => {
  return gulp.watch(
    path.join(dev_php_path, '**/*.php'), ['build_structure']
  );
});

gulp.task('watch_eslint_js', () => {
  return gulp.watch(
    path.join(dev_script_path, '**/*.js'), ['lint_js']
  );
});

gulp.task('notify_js_build', () => {
  return gulp.watch(
    path.join(build_script_path, '**/*.js'), (event) => {
      notify.logLevel(0);
      gulp.src(event.path)
        .pipe(notify((file) => {
          if(script_notification_flag) {
            return {
              title: 'JS Builder',
              message: '<%= file.relative %> updated'
            };
          }
          return false;
        }));
    })
});

gulp.task('watch_dev_style', () => {
  return gulp.watch(
      path.join(dev_style_path, '**/*.scss'), gulpsync.async(['update_style', 'lint_style'])
  );
});

gulp.task('notify_style_build', () => {
  return gulp.watch(
    path.join(build_style_path, '**/*.css'), (event) => {
      notify.logLevel(2);
      gulp.src(event.path)
        .pipe(notify((file) => {
          if(style_notification_flag) {
            return {
              title: 'SASS Builder',
              message: '<%= file.relative %> updated'
            };
          }
          return false;
        }));
    })
});

// ==========================
// FUNCTIONS
// ==========================

function buildJS() {
  return gulp.src([
    path.join(dev_script_scope_path, '**/*.js')
  ])
  .pipe(named())
  .pipe(webpackStream({
    watch: (argv.watch !== undefined),
    module: {
      loaders: [{
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          presets: require.resolve('babel-preset-es2015'),
          env: {
            test: {
              plugins: [
                ['babel-plugin-webpack-alias']
              ]
            }
          }
        }
      }]
    },
    devtool: 'source-map',
    resolve: {
      alias: {
        'COMPONENTS': path.join(dev_script_path, '_components'),
        'CONTROLLERS': path.join(dev_script_path, '_controllers'),
        'UTILITIES': path.join(dev_script_path, '_utilities')
      }
    },
    resolveLoader: {
      root: path.join(base_path, 'node_modules')
    },
    plugins: [
      new webpack.optimize.UglifyJsPlugin({
        compress: {
          warnings: false
        }
      })
    ]
  }))
  .pipe(gulp.dest(build_script_path));
}

function lintJS() {
  return gulp.src([path.join(dev_script_path, '**/*.js')])
    .pipe(eslint({
      useEslintrc: true,
      configFile: path.join(base_path, '.eslintrc')
    }))
    .pipe(eslint.format());
}

function generateImageHelper() { // *.+(jpeg|jpg|png|gif|svg)
  return gulp.src(path.join(dev_image_path, '**/*.+(png|jpg|jpeg|gif)'))
    .pipe(sassImage({
      targetFile: path.join(dev_style_path, '_utilities', '_generated-imagehelper.scss'),
      http_images_path: build_image_path,
      prefix: ''
    }))
    .pipe(gulp.dest(base_path));
}

function lintStyle() {
  return gulp.src(path.join(dev_style_path, '**/*.scss'))
    .pipe(sassLint({
      configFile: path.join(base_path, '.sass-lint.yml')
    }))
    .pipe(sassLint.format());
}

function updateStyle() {
  return gulp.src(path.join(dev_style_scope_path, '**/*.scss'))
    .pipe(cached('sassfiles'))
    .pipe(progeny())
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss(processors))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(build_style_path));
}

function buildStyle() {
  return gulp.src(path.join(dev_style_scope_path, '**/*.scss'))
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss(processors))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(build_style_path));
}

function buildPhp() {
  return gulp.src(path.join(dev_php_path, '*.php'))
    .pipe(include({
        extensions: "php",
        hardFail: true,
        includePaths: [
          dev_php_path
        ]
      }))
      .on('error', console.log)
    .pipe(gulp.dest(tmp_files_path));
}

function minifyPhp() {
  return gulp.src(path.join(tmp_files_path, '*.php'))
    .pipe(phpMinify())
    .pipe(gulp.dest(build_php_path));
}
