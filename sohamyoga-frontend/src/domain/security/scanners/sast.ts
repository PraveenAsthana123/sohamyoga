import { execFile } from 'child_process';
import { promisify } from 'util';
import type { NormalizedFinding, ScanResult, Severity } from '../types';
import { scannerEnv } from '../execEnv';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 128 * 1024 * 1024;

interface SemgrepResult {
  check_id: string;
  path: string;
  start: { line: number };
  extra: {
    message: string;
    severity: string;
    metadata?: { cwe?: string[]; owasp?: string[] };
  };
}
interface SemgrepReport {
  results: SemgrepResult[];
  errors: unknown[];
}

function semgrepSeverity(s: string): Severity {
  const upper = s.toUpperCase();
  if (upper === 'ERROR') return 'high';
  if (upper === 'WARNING') return 'medium';
  return 'low'; // INFO
}

// Free registry rulesets (semgrep.dev/r), no login required for local scans.
const RULESETS = ['p/security-audit', 'p/owasp-top-ten'];

export async function runSemgrep(sourceDir: string): Promise<ScanResult> {
  const args = ['--json', '--quiet'];
  for (const ruleset of RULESETS) args.push('--config', ruleset);
  args.push(sourceDir);

  const { stdout } = await execFileAsync('semgrep', args, {
    cwd: sourceDir,
    maxBuffer: MAX_BUFFER,
    env: scannerEnv(),
    timeout: 5 * 60 * 1000,
  });

  const report: SemgrepReport = JSON.parse(stdout);
  const findings: NormalizedFinding[] = report.results.map(r => ({
    severity: semgrepSeverity(r.extra.severity),
    title: r.check_id.split('.').pop() ?? r.check_id,
    description: r.extra.message,
    filePath: r.path,
    lineNumber: r.start.line,
    ruleId: r.check_id,
  }));

  return { findings, rawOutput: report };
}
