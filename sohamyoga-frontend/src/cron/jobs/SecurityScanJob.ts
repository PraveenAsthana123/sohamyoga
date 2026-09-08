// SecurityScanJob — Nightly
// Runs every real scanner registered in src/domain/security/registry.ts
// (SAST/semgrep, SCA/npm-audit+trivy-fs, IaC/trivy-config+checkov,
// DAST/ZAP-baseline) and persists findings to security_scan_run /
// security_finding. Sequential, not parallel -- semgrep and ZAP are CPU/
// network heavy and this job already runs at low-traffic hours; running
// them concurrently would just contend for the same cores with no benefit.
import { allScanners } from '../../domain/security/registry';
import { executeScan } from '../../domain/security/runScan';

export async function run(): Promise<void> {
  const scanners = allScanners();
  console.log(`[SecurityScanJob] Running ${scanners.length} scanners (SAST/SCA/IaC/DAST)...`);

  for (const scanner of scanners) {
    const label = `${scanner.category}/${scanner.tool}/${scanner.target}`;
    try {
      const result = await executeScan(scanner, 'cron:SecurityScanJob');
      console.log(`[SecurityScanJob] ${label} -> ${result.status} (run ${result.runId})`);
    } catch (err) {
      console.error(`[SecurityScanJob] ${label} threw unexpectedly:`, err);
    }
  }

  console.log('[SecurityScanJob] Done.');
}
