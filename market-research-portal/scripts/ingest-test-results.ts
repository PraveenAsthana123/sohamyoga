// Testing layer of Operations & Failure Tracking. Reads the Playwright
// JSON reporter output and records one summary row per run — run this after
// `npx playwright test`, e.g. `npm run test:e2e:tracked`.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getPool } from '../src/lib/postgres';

interface PwTest { status: string; }
interface PwSpec { file: string; title: string; tests: PwTest[]; }
interface PwSuite { specs?: PwSpec[]; suites?: PwSuite[]; }
interface PwReport { suites: PwSuite[]; stats: { expected: number; unexpected: number; flaky: number; skipped: number } }

function collectFailingTitles(suite: PwSuite): string[] {
  const out: string[] = [];
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      if (test.status !== 'expected' && test.status !== 'skipped') {
        out.push(`${spec.file} — ${spec.title}`);
      }
    }
  }
  for (const sub of suite.suites ?? []) out.push(...collectFailingTitles(sub));
  return out;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    const envText = await readFile(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const raw of envText.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const split = line.indexOf('=');
      if (split < 1) continue;
      const key = line.slice(0, split).trim();
      const value = line.slice(split + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      if (!process.env[key]) process.env[key] = value;
    }
  }

  const reportPath = path.join(process.cwd(), 'test-results/pipeline.json');
  const report = JSON.parse(await readFile(reportPath, 'utf8')) as PwReport;
  const failingTitles = report.suites.flatMap(collectFailingTitles);

  await getPool().query(
    `INSERT INTO test_run (suite, expected, unexpected, flaky, skipped, failing_titles)
     VALUES ('pipeline', $1, $2, $3, $4, $5)`,
    [report.stats.expected, report.stats.unexpected, report.stats.flaky, report.stats.skipped, JSON.stringify(failingTitles)],
  );
  console.log(`test_run recorded: ${report.stats.expected} expected, ${report.stats.unexpected} unexpected, ${report.stats.flaky} flaky`);
  await getPool().end();
}
main().catch(error => { console.error(error); process.exit(1); });
