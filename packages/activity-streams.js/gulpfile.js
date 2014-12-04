var gulp       = require('gulp'),
    fs         = require('fs'),
    browserify = require('gulp-browserify'),
    uglify     = require('gulp-uglify'),
    rename     = require('gulp-rename'),
    pkg        = require('./package.json');

gulp.task('default', function () {

  gulp.src('lib/activity-streams.js')
      .pipe(browserify({ standalone: 'Activity' }))
      .pipe(gulp.dest('browser/'))
      .pipe(uglify())
      .pipe(rename('activity-streams.min.js'))
      .pipe(gulp.dest('browser/'));
});
