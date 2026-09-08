import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, rm, chmod } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { NormalizedFinding, ScanResult, Severity } from '../types';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;

interface ZapAlertInstance { uri: string; param?: string; evidence?: string }
interface ZapAlert {
  pluginid: string;
  alert: string;
  riskcode: string;
  desc: string;
  solution?: string;
  instances: ZapAlertInstance[];
  count: string;
}
interface ZapSite { alerts: ZapAlert[] }
interface ZapReport { site?: ZapSite[] }

function zapSeverity(riskcode: string): Severity {
  if (riskcode === '3') return 'high';
  if (riskcode === '2') return 'medium';
  if (riskcode === '1') return 'low';
  return 'info';
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// OWASP ZAP baseline scan -- a real passive DAST pass (spiders the target
// for `minutes`, then runs ZAP's passive scan rules; no active/attack
// payloads are sent, matching zap-baseline.py's intent as a CI-safe scan).
// Requires the target app to already be running and reachable from the
// Docker container via --network host.
export async function runZapBaseline(targetUrl: string, minutes = 1): Promise<ScanResult> {
  const workDir = await mkdtemp(join(tmpdir(), 'zap-scan-'));
  await chmod(workDir, 0o777);
  const reportFile = 'zap-report.json';

  try {
    try {
      await execFileAsync(
        'docker',
        ['run', '--rm', '--network', 'host', '-v', `${workDir}:/zap/wrk:rw`,
          'zaproxy/zap-stable', 'zap-baseline.py', '-t', targetUrl, '-J', reportFile, '-m', String(minutes)],
        { maxBuffer: MAX_BUFFER, timeout: 10 * 60 * 1000 },
      );
    } catch (err) {
      // zap-baseline.py exits non-zero when it finds WARN/FAIL alerts --
      // that's the expected "scan found things" outcome, not a crash.
      const e = err as { code?: number };
      if (e.code !== 1 && e.code !== 2) throw err;
    }

    const raw = await readFile(join(workDir, reportFile), 'utf8');
    const report: ZapReport = JSON.parse(raw);
    const findings: NormalizedFinding[] = [];

    for (const site of report.site ?? []) {
      for (const alert of site.alerts ?? []) {
        const firstInstance = alert.instances[0];
        findings.push({
          severity: zapSeverity(alert.riskcode),
          title: alert.alert,
          description: [stripHtml(alert.desc), alert.solution ? `Fix: ${stripHtml(alert.solution)}` : null]
            .filter(Boolean).join(' '),
          filePath: firstInstance?.uri,
          ruleId: alert.pluginid,
        });
      }
    }

    return { findings, rawOutput: report };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
