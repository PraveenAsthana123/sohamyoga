import { runNpmAudit, runTrivyFs } from './scanners/sca';
import { runTrivyConfig, runCheckovDockerfile, DOCKERFILE_TARGETS } from './scanners/iac';
import { runSemgrep } from './scanners/sast';
import { runZapBaseline } from './scanners/dast';
import type { ScannerDefinition } from './types';

// Real paths on this machine -- overridable via env for other environments.
const REPO_ROOT = process.env.SECURITY_SCAN_REPO_ROOT ?? '/mnt/deepa/sohamyoga';
const FRONTEND_DIR = `${REPO_ROOT}/sohamyoga-frontend`;
const MARKET_RESEARCH_DIR = `${REPO_ROOT}/market-research-portal`;

const SCA_APPS = [
  { target: 'sohamyoga-frontend', dir: FRONTEND_DIR },
  { target: 'market-research-portal', dir: MARKET_RESEARCH_DIR },
];

export function scaScanners(): ScannerDefinition[] {
  return SCA_APPS.flatMap(app => [
    { category: 'sca' as const, tool: 'npm_audit', target: app.target, run: () => runNpmAudit(app.dir) },
    { category: 'sca' as const, tool: 'trivy_fs', target: app.target, run: () => runTrivyFs(app.dir) },
  ]);
}

export function iacScanners(): ScannerDefinition[] {
  return DOCKERFILE_TARGETS.flatMap(d => [
    { category: 'iac' as const, tool: 'trivy_config', target: d.label, run: () => runTrivyConfig(REPO_ROOT, d.path) },
    { category: 'iac' as const, tool: 'checkov', target: d.label, run: () => runCheckovDockerfile(REPO_ROOT, d.path) },
  ]);
}

export function sastScanners(): ScannerDefinition[] {
  return [
    { category: 'sast' as const, tool: 'semgrep', target: 'sohamyoga-frontend', run: () => runSemgrep(`${FRONTEND_DIR}/src`) },
    { category: 'sast' as const, tool: 'semgrep', target: 'market-research-portal', run: () => runSemgrep(`${MARKET_RESEARCH_DIR}/src`) },
  ];
}

export function dastScanners(): ScannerDefinition[] {
  return [
    { category: 'dast' as const, tool: 'zap_baseline', target: 'sohamyoga-frontend', run: () => runZapBaseline(process.env.SECURITY_SCAN_FRONTEND_URL ?? 'http://127.0.0.1:8095') },
  ];
}

export function allScanners(): ScannerDefinition[] {
  return [...scaScanners(), ...iacScanners(), ...sastScanners(), ...dastScanners()];
}

export function findScanner(category: string, tool: string, target: string): ScannerDefinition | undefined {
  return allScanners().find(s => s.category === category && s.tool === tool && s.target === target);
}
