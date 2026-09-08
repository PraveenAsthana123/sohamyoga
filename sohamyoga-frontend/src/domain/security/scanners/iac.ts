import { execFile } from 'child_process';
import { promisify } from 'util';
import type { NormalizedFinding, ScanResult, Severity } from '../types';
import { scannerEnv } from '../execEnv';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;

// Real, verified tool limitation (checked live 2026-09-01): neither trivy
// 0.70.0's `config` misconfig-scanners list (dockerfile/k8s/terraform/
// cloudformation/helm/ansible/azure-arm) nor checkov 3.3.16's --framework
// list includes docker-compose. Both only scan Dockerfiles directly. This
// is why root docker-compose.yml has no IaC scanner target below -- not an
// oversight, no current OSS tool covers it.
export const DOCKERFILE_TARGETS = [
  { label: 'sohamyoga-frontend:Dockerfile', path: 'sohamyoga-frontend/Dockerfile' },
  { label: 'sohamyoga-frontend:Dockerfile.cron', path: 'sohamyoga-frontend/Dockerfile.cron' },
  { label: 'sohamyoga-backend:Dockerfile', path: 'SohamYoga/SohamYoga.Web/Dockerfile' },
];

interface TrivyMisconfig {
  ID: string;
  Title: string;
  Description?: string;
  Severity: string;
  Resolution?: string;
}
interface TrivyResult {
  Target: string;
  Misconfigurations?: TrivyMisconfig[];
}
interface TrivyReport {
  Results?: TrivyResult[];
}

function trivySeverity(s: string): Severity {
  const lower = s.toLowerCase();
  if (lower === 'critical' || lower === 'high' || lower === 'medium' || lower === 'low') return lower;
  return 'info';
}

export async function runTrivyConfig(repoRoot: string, dockerfilePath: string): Promise<ScanResult> {
  const { stdout } = await execFileAsync(
    'trivy',
    ['config', '--format', 'json', '--skip-version-check', dockerfilePath],
    { cwd: repoRoot, maxBuffer: MAX_BUFFER, env: scannerEnv() },
  );
  const report: TrivyReport = JSON.parse(stdout);
  const findings: NormalizedFinding[] = [];

  for (const result of report.Results ?? []) {
    for (const mis of result.Misconfigurations ?? []) {
      findings.push({
        severity: trivySeverity(mis.Severity),
        title: mis.Title,
        description: [mis.Description, mis.Resolution].filter(Boolean).join(' — '),
        filePath: dockerfilePath,
        ruleId: mis.ID,
      });
    }
  }

  return { findings, rawOutput: report };
}

interface CheckovFailedCheck {
  check_id: string;
  check_name: string;
  file_path: string;
  file_line_range?: [number, number];
  severity?: string | null;
  guideline?: string;
}
interface CheckovReport {
  results?: { failed_checks?: CheckovFailedCheck[] };
}

function checkovSeverity(s: string | null | undefined): Severity {
  if (!s) return 'medium'; // checkov's free CLI leaves severity null on most checks; treat as needs-review
  const lower = s.toLowerCase();
  if (lower === 'critical' || lower === 'high' || lower === 'medium' || lower === 'low') return lower;
  return 'info';
}

export async function runCheckovDockerfile(repoRoot: string, dockerfilePath: string): Promise<ScanResult> {
  let stdout = '';
  try {
    const result = await execFileAsync(
      'checkov',
      ['-f', dockerfilePath, '--framework', 'dockerfile', '--output', 'json', '--quiet', '--compact'],
      { cwd: repoRoot, maxBuffer: MAX_BUFFER, env: scannerEnv() },
    );
    stdout = result.stdout;
  } catch (err) {
    const e = err as { stdout?: string };
    if (!e.stdout) throw err;
    stdout = e.stdout;
  }

  const report: CheckovReport = JSON.parse(stdout);
  const findings: NormalizedFinding[] = [];

  for (const check of report.results?.failed_checks ?? []) {
    findings.push({
      severity: checkovSeverity(check.severity),
      title: check.check_name,
      description: check.guideline,
      filePath: check.file_path,
      lineNumber: check.file_line_range?.[0],
      ruleId: check.check_id,
    });
  }

  return { findings, rawOutput: report };
}
