var gulp        = require('gulp');
var gutil       = require('gulp-util');
var bower       = require('bower');
var concat      = require('gulp-concat');
var sass        = require('gulp-sass');
var minifyCss   = require('gulp-minify-css');
var rename      = require('gulp-rename');
var sh          = require('shelljs');
var jshint      = require('gulp-jshint');
var uglify      = require('gulp-uglify');
var minifyHtml  = require("gulp-minify-html");

// Default Task
gulp.task('default', ['html', 'sass', 'css', 'js']);


var paths = {
  sass: ['./scss/**/*.scss'],
  js:   ['js/*.js','!js/*.min.js', '!js/all.js'],
  html: ['html/*.html'],
  css:  ['css/*.css','!css/*.min.css'],
};

// Watch Files For Changes
gulp.task('watch', ['default'], function() {
//  gulp.watch('js/*.js', ['lint', 'scripts']);
//   gulp.watch('scss/*.scss', ['sass']);
    gulp.watch(paths.js,   ['lint', 'js']);
    gulp.watch(paths.sass, ['sass']);
    gulp.watch(paths.html, ['html']);
});


gulp.task('html', function () {
    gulp.src(paths.html)
    .pipe(minifyHtml())
    .pipe(gulp.dest('.'));
});

gulp.task('sass', function(done) {
  gulp.src('./scss/ionic.app.scss')
    .pipe(sass())
    .pipe(gulp.dest('./www/css/'))
    .pipe(minifyCss({
      keepSpecialComments: 0
    }))
    .pipe(rename({ extname: '.min.css' }))
    .pipe(gulp.dest('./www/css/'))
    .on('end', done);
});


gulp.task('css', function () {
    gulp.src(paths.css)
    .pipe(minifyCss())
    .pipe(rename({ extname: '.min.css' }))
    .pipe(gulp.dest('css'));
});


// Concatenate & Minify JS
gulp.task('js', function() {
    return gulp.src(paths.js)
    .pipe(concat('all.js'))
    .pipe(gulp.dest('js'))
    .pipe(rename('all.min.js'))
    .pipe(uglify())
    .pipe(gulp.dest('js'));
});


// Lint Task
gulp.task('lint', function() {
    return gulp.src(paths.js )
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});


gulp.task('install', ['git-check'], function() {
    return bower.commands.install()
    .on('log', function(data) {
        gutil.log('bower', gutil.colors.cyan(data.id), data.message);
    });
});


gulp.task('git-check', function(done) {
    if (!sh.which('git')) {
        console.log(
            '  ' + gutil.colors.red('Git is not installed.'),
                    '\n  Git, the version control system, is required to download Ionic.',
                    '\n  Download git here:', gutil.colors.cyan('http://git-scm.com/downloads') + '.',
                    '\n  Once git is installed, run \'' + gutil.colors.cyan('gulp install') + '\' again.'
        );
        process.exit(1);
    }
    done();
});

