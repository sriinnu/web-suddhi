import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';

const production = !process.env.ROLLUP_WATCH;

export default [
  // Background service worker
  {
    input: 'src/background/index.js',
    output: {
      file: 'background/background.js',
      format: 'iife',
      name: 'WebSuddhiBackground'
    },
    plugins: [
      resolve(),
      production && terser(),
      copy({
        targets: [
          { src: 'background/*.js', dest: 'background', noClean: true, skipDeletion: true }
        ]
      })
    ]
  },

  // Popup
  {
    input: 'src/popup/index.js',
    output: {
      file: 'popup/popup.js',
      format: 'iife',
      name: 'WebSuddhiPopup'
    },
    plugins: [
      resolve(),
      production && terser()
    ]
  },

  // Content scripts
  {
    input: 'src/content/index.js',
    output: {
      file: 'content/index.js',
      format: 'iife',
      name: 'WebSuddhiContent'
    },
    plugins: [
      resolve(),
      production && terser()
    ]
  }
];
