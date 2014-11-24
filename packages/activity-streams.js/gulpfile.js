var gulp    = require('gulp');
var minify  = require('minify');
var fs      = require('fs');
var pkg     = require('./package.json');

var credits = "/* activity-streams.js v" + pkg.version + " | (c) 2012-2014 Nick Jennings | License: MIT | https://github.com/silverbucket/activity-streams.js */\n";
var header = "(function(w,undefined){var scope={};";
var footer = "w.Activity=scope.Activity;})(window);\n";

gulp.task('default', function () {

  var data = credits + header;
  minify('lib/activity-streams.js', {
    returnName  : true,
    log         : true
  }, function (error, asData) {
    if (error) {
      throw new Error(error);
    }

    minify('node_modules/array-keys/array-keys.js', {
      returnName  : true,
      log         : true
    }, function (error, akData) {
      if (error) {
        throw new Error(error);
      }

      data += akData + asData + footer;
      fs.writeFile('dist/activity-streams.min.js', data);
    });
  });

});
