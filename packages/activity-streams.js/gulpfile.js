var source     = require('vinyl-source-stream'),
    streamify  = require('gulp-streamify'),
    browserify = require('browserify'),
    uglify     = require('gulp-uglify'),
    rename     = require('gulp-rename'),
    gulp       = require('gulp');

var baseDir = './lib/';
var baseFileName = 'activity-streams';
var objName  = 'ActivityStreams';

gulp.task('default', function() {
  var bundleStream = browserify(baseDir + baseFileName + '.js', { standalone: objName }).bundle();

  return bundleStream
         .pipe(source(baseFileName + '.js'))
         .pipe(gulp.dest('./browser'))
         .pipe(streamify(uglify()))
         .pipe(rename(baseFileName + '.min.js'))
         .pipe(gulp.dest('./browser'));
});
