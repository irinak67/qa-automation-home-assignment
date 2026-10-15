import { application } from './config/test.config';
import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '.env'), quiet: true });

// Separate outputs prevent concurrent runners from deleting each other's traces.
const runMode = process.argv.includes('test-server')
  ? 'vscode'
  : process.argv.some(argument => argument === '--ui' || argument.startsWith('--ui='))
    ? 'ui'
    : 'cli';

export default defineConfig({
  testDir: './tests',
  outputDir: `test-results/${runMode}`,
  fullyParallel: false,
  // Limit concurrent mailbox connections and email traffic.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: `playwright-report/${runMode}` }]],
  use: {
    testIdAttribute: application.testIdAttribute,
    baseURL: application.baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
