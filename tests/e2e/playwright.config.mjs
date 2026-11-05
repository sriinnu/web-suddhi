import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.mjs/,
  outputDir: '../../test-results/artifacts',
  timeout: 120000,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: '../../test-results/html-report', open: 'never' }]],
});
