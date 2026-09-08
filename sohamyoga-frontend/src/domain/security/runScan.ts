import { query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { computeFingerprint } from './fingerprint';
import type { ScannerDefinition, Severity } from './types';

const EMPTY_SUMMARY: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

export async function executeScan(scanner: ScannerDefinition, triggeredBy: string): Promise<{ runId: string; status: 'completed' | 'failed' }> {
  const tenantId = await getPrimaryTenantId();
  const startedAt = Date.now();

  const runRow = await query<{ id: string }>(
    `INSERT INTO security_scan_run (tenant_id, category, tool, target, status, triggered_by)
     VALUES ($1, $2, $3, $4, 'running', $5) RETURNING id`,
    [tenantId, scanner.category, scanner.tool, scanner.target, triggeredBy],
  );
  const runId = runRow.rows[0].id;

  try {
    const { findings, rawOutput } = await scanner.run();
    const summary = { ...EMPTY_SUMMARY };
    const now = new Date();

    for (const finding of findings) {
      summary[finding.severity] += 1;
      const fingerprint = computeFingerprint(scanner.tool, finding);
      await query(
        `INSERT INTO security_finding (
           scan_run_id, tenant_id, severity, title, description, file_path, line_number,
           package_name, installed_version, fixed_version, cve_id, rule_id, fingerprint, last_seen_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (tenant_id, fingerprint) DO UPDATE SET
           scan_run_id = EXCLUDED.scan_run_id,
           last_seen_at = EXCLUDED.last_seen_at,
           -- a finding a human already triaged stays triaged across re-scans
           -- unless it had been marked fixed and just reappeared
           status = CASE WHEN security_finding.status = 'fixed' THEN 'open' ELSE security_finding.status END,
           resolved_at = CASE WHEN security_finding.status = 'fixed' THEN NULL ELSE security_finding.resolved_at END,
           resolved_by = CASE WHEN security_finding.status = 'fixed' THEN NULL ELSE security_finding.resolved_by END`,
        [runId, tenantId, finding.severity, finding.title, finding.description ?? null, finding.filePath ?? null,
         finding.lineNumber ?? null, finding.packageName ?? null, finding.installedVersion ?? null,
         finding.fixedVersion ?? null, finding.cveId ?? null, finding.ruleId ?? null, fingerprint, now],
      );
    }

    await query(
      `UPDATE security_scan_run SET status = 'completed', completed_at = now(), duration_ms = $2, summary = $3, raw_output = $4 WHERE id = $1`,
      [runId, Date.now() - startedAt, JSON.stringify(summary), JSON.stringify(rawOutput)],
    );
    return { runId, status: 'completed' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await query(
      `UPDATE security_scan_run SET status = 'failed', completed_at = now(), duration_ms = $2, error_message = $3 WHERE id = $1`,
      [runId, Date.now() - startedAt, message.slice(0, 4000)],
    );
    return { runId, status: 'failed' };
  }
}
