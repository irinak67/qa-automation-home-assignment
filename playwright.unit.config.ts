import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/unit',
  workers: 1,
  timeout: 5_000,
  reporter: 'list',
  outputDir: 'test-results/unit',
});
