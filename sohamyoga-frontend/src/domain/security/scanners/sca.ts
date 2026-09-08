import { execFile } from 'child_process';
import { promisify } from 'util';
import type { NormalizedFinding, ScanResult, Severity } from '../types';
import { scannerEnv } from '../execEnv';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;

interface NpmAuditVia {
  source?: number;
  name?: string;
  title?: string;
  url?: string;
  severity?: string;
  cwe?: string[];
  range?: string;
}
interface NpmAuditVuln {
  name: string;
  severity: string;
  via: (string | NpmAuditVia)[];
  range: string;
  fixAvailable?: boolean | { name: string; version: string };
}
interface NpmAuditReport {
  vulnerabilities: Record<string, NpmAuditVuln>;
}

function npmSeverity(s: string): Severity {
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'moderate') return 'medium';
  if (s === 'low') return 'low';
  return 'info';
}

// `npm audit` exits non-zero when vulnerabilities are found -- that's
// expected, not a scan failure, so stdout is read regardless of exit code.
export async function runNpmAudit(appDir: string): Promise<ScanResult> {
  let stdout = '';
  try {
    const result = await execFileAsync('npm', ['audit', '--json'], { cwd: appDir, maxBuffer: MAX_BUFFER, env: scannerEnv() });
    stdout = result.stdout;
  } catch (err) {
    const e = err as { stdout?: string };
    if (!e.stdout) throw err;
    stdout = e.stdout;
  }

  const report: NpmAuditReport = JSON.parse(stdout);
  const findings: NormalizedFinding[] = [];

  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    // Only the `via` entries that carry full advisory detail (objects) are
    // real, addressable findings -- plain-string entries just name a
    // transitive dependency and duplicate the advisory already attached
    // to that dependency's own package entry.
    for (const via of vuln.via) {
      if (typeof via === 'string') continue;
      findings.push({
        severity: npmSeverity(via.severity ?? vuln.severity),
        title: via.title ?? `${vuln.name} vulnerability`,
        description: via.url,
        packageName: vuln.name,
        installedVersion: via.range ?? vuln.range,
        fixedVersion: typeof vuln.fixAvailable === 'object' ? vuln.fixAvailable.version : undefined,
        cveId: via.url?.includes('advisories/GHSA') ? via.url.split('/').pop() : undefined,
        ruleId: via.url,
      });
    }
  }

  return { findings, rawOutput: report };
}

interface TrivyVuln {
  VulnerabilityID: string;
  PkgName: string;
  InstalledVersion: string;
  FixedVersion?: string;
  Title?: string;
  Description?: string;
  Severity: string;
  PrimaryURL?: string;
}
interface TrivyResult {
  Target: string;
  Vulnerabilities?: TrivyVuln[];
}
interface TrivyReport {
  Results?: TrivyResult[];
}

function trivySeverity(s: string): Severity {
  const lower = s.toLowerCase();
  if (lower === 'critical' || lower === 'high' || lower === 'medium' || lower === 'low') return lower;
  return 'info';
}

export async function runTrivyFs(appDir: string): Promise<ScanResult> {
  const { stdout } = await execFileAsync(
    'trivy',
    ['fs', '--format', 'json', '--scanners', 'vuln', '--skip-dirs', 'node_modules', '--quiet', '.'],
    { cwd: appDir, maxBuffer: MAX_BUFFER, env: scannerEnv() },
  );
  const report: TrivyReport = JSON.parse(stdout);
  const findings: NormalizedFinding[] = [];

  for (const result of report.Results ?? []) {
    for (const vuln of result.Vulnerabilities ?? []) {
      findings.push({
        severity: trivySeverity(vuln.Severity),
        title: vuln.Title ?? `${vuln.PkgName} ${vuln.VulnerabilityID}`,
        description: vuln.Description,
        filePath: result.Target,
        packageName: vuln.PkgName,
        installedVersion: vuln.InstalledVersion,
        fixedVersion: vuln.FixedVersion,
        cveId: vuln.VulnerabilityID,
        ruleId: vuln.PrimaryURL,
      });
    }
  }

  return { findings, rawOutput: report };
}
