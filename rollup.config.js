/**
 * Rollup build configuration for all WebSuddhi bundles.
 *
 * Produces four IIFE bundles under dist/:
 *   - content/index.js   (injected into web pages)
 *   - background/index.js (service worker / background script)
 *   - popup/index.js     (extension popup)
 *   - options/index.js   (options page)
 */
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const production = !process.env.ROLLUP_WATCH;

/** Shared plugins for every bundle */
const plugins = [
  resolve(),
  production && terser(),
].filter(Boolean);

export default [
  {
    input: 'src/content/index.js',
    output: { file: 'dist/content/index.js', format: 'iife', name: 'WebSuddhiContent' },
    plugins,
  },
  {
    input: 'src/background/index.js',
    output: {
      file: 'dist/background/index.js',
      format: 'iife',
      name: 'WebSuddhiBackground',
      // Load phishing-detector.js (IIFE) before the main bundle.
      // importScripts is available at top-level in MV3 service workers.
      banner: 'try { importScripts("phishing-detector.js"); } catch(e) { console.warn("[WebSuddhi] phishing-detector load failed:", e); }',
    },
    plugins,
  },
  {
    input: 'src/popup/index.js',
    output: { file: 'dist/popup/index.js', format: 'iife', name: 'WebSuddhiPopup' },
    plugins,
  },
  {
    input: 'src/options/index.js',
    output: { file: 'dist/options/index.js', format: 'iife', name: 'WebSuddhiOptions' },
    plugins,
  },
];
