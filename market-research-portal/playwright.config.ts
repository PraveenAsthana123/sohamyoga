import { defineConfig, devices } from 'playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Playwright doesn't auto-load .env.local the way `next dev` does. Without
// this, tests/e2e/pipeline.spec.ts falls back to a passwordless
// SOHAMYOGA_RO_DATABASE_URL default and crashes with a SASL auth error
// instead of exercising the real cross-DB read. Same manual-parse pattern
// already used in scripts/migrate.ts and scripts/ingest-test-results.ts.
try {
  const envText = readFileSync(path.join(__dirname, '.env.local'), 'utf8');
  for (const raw of envText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const split = line.indexOf('=');
    if (split < 1) continue;
    const key = line.slice(0, split).trim();
    const value = line.slice(split + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* .env.local is optional (e.g. CI supplies real env vars directly) */ }

const baseURL = process.env.MRP_BASE_URL || 'http://127.0.0.1:8086';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/artifacts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/pipeline.json' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chrome-desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
});
