// Shared types for all yoga-portal domain MCP servers.
// Every registry file imports from here instead of declaring its own tier enum.

export type McpApprovalTier =
  | 'auto'               // no human needed — model executes immediately
  | 'staff'              // staff role required; no separate approval step
  | 'customer_confirm'   // customer must confirm on their own device
  | 'staff_approval'     // staff must actively approve before execution
  | 'admin'              // admin approval required
  | 'admin_destructive'; // admin approval + irreversibility warning

export type McpAvailability =
  | 'official'    // maintained by product owner (e.g. GitHub MCP)
  | 'community'   // open-source community server — review before use
  | 'custom'      // built in this project wrapping a REST/OpenAPI
  | 'none';       // no MCP; AI drafts, human posts manually

export interface McpTool {
  name:         string;
  description:  string;
  tier:         McpApprovalTier;
  riskLevel:    1 | 2 | 3 | 4 | 5;
  inputSchema:  Record<string, unknown>;
  safetyNote?:  string;
  tags?:        string[];
}

export interface McpServerManifest {
  id:               string;
  slug:             string;          // e.g. "social-mcp"
  name:             string;          // display name
  description:      string;
  version:          string;
  tools:            McpTool[];
  backingServices:  string[];        // upstream products this server wraps
  availability:     McpAvailability;
  implementationNote?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export function requiresApproval(tier: McpApprovalTier): boolean {
  return ['staff_approval', 'admin', 'admin_destructive'].includes(tier);
}

export function isAutomatic(tier: McpApprovalTier): boolean {
  return tier === 'auto';
}

export function countByTier(tools: McpTool[]): Record<McpApprovalTier, number> {
  const counts: Record<McpApprovalTier, number> = {
    auto: 0, staff: 0, customer_confirm: 0,
    staff_approval: 0, admin: 0, admin_destructive: 0,
  };
  tools.forEach((t) => counts[t.tier]++);
  return counts;
}

export function getApprovalRequiredTools(tools: McpTool[]): string[] {
  return tools.filter((t) => requiresApproval(t.tier)).map((t) => t.name);
}

export function findTool(manifest: McpServerManifest, name: string): McpTool | undefined {
  return manifest.tools.find((t) => t.name === name);
}

export function highRiskTools(tools: McpTool[], minRisk = 4): McpTool[] {
  return tools.filter((t) => t.riskLevel >= minRisk);
}
