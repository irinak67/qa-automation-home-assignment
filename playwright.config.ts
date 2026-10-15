import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '.env'), quiet: true });

// VS Code and the UI runner can stay open together. Keep their trace files
// separate so starting one runner does not clean up the other's artifacts.
const runMode = process.argv.includes('test-server')
  ? 'vscode'
  : process.argv.some(argument => argument === '--ui' || argument.startsWith('--ui='))
    ? 'ui'
    : 'cli';

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/unit/**',
  outputDir: `test-results/${runMode}`,
  fullyParallel: false,
  // A single worker avoids competing browser startups and mailbox traffic.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: `playwright-report/${runMode}` }]],
  use: {
    testIdAttribute: 'data-qa',
    baseURL: 'https://app.canary.talkspace.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
