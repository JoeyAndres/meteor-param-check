import gulp from 'gulp';
import babel from 'gulp-babel';
import concat from 'gulp-concat';

gulp.task('transpile', () => {
  return gulp.src('src/**/*.js')
    .pipe(babel({
      presets: ['es2015']
    }))
    //.pipe(concat('dbridge.js'))
    .pipe(gulp.dest('dist'));
});

gulp.task('default', ['transpile']);
