import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default {
  input: 'src/content/index.js',
  output: {
    file: 'dist/content/index.js',
    format: 'iife',
    name: 'WebSuddhiContent'
  },
  plugins: [
    resolve(),
    production && terser()
  ].filter(Boolean)
};
