import { createHash } from 'crypto';
import type { NormalizedFinding } from './types';

// Deterministic identity for a finding, stable across re-scans so the same
// unfixed issue doesn't create a new row every run (dedup key for
// security_finding.fingerprint). Deliberately excludes description/severity
// (advisory text can be reworded upstream) -- identity is tool + rule/CVE +
// location + package, the parts that identify "this is the same issue."
export function computeFingerprint(tool: string, finding: NormalizedFinding): string {
  const parts = [
    tool,
    finding.ruleId ?? '',
    finding.cveId ?? '',
    finding.packageName ?? '',
    finding.filePath ?? '',
    String(finding.lineNumber ?? ''),
    finding.title,
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
