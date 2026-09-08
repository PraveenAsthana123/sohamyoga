export type ScanCategory = 'sast' | 'sca' | 'iac' | 'dast';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface NormalizedFinding {
  severity: Severity;
  title: string;
  description?: string;
  filePath?: string;
  lineNumber?: number;
  packageName?: string;
  installedVersion?: string;
  fixedVersion?: string;
  cveId?: string;
  ruleId?: string;
}

export interface ScanResult {
  findings: NormalizedFinding[];
  rawOutput: unknown;
}

export interface ScannerDefinition {
  category: ScanCategory;
  tool: string;
  target: string;
  run: () => Promise<ScanResult>;
}
