import { describe, it, expect } from '@jest/globals';
import {
  ALL_MCP_SERVERS,
  routeTool,
  getToolTier,
  buildGatewaySummary,
  getAllApprovalRequiredTools,
  getAllHighRiskRoutes,
  getServer,
} from '../../../domain/mcp/gateway-registry';
import { requiresApproval } from '../../../domain/mcp/types';

// ── Registry completeness ─────────────────────────────────────────────────────

describe('ALL_MCP_SERVERS — registry completeness', () => {
  it('registers exactly 15 domain MCP servers', () => {
    expect(ALL_MCP_SERVERS).toHaveLength(15);
  });

  it('all servers have a non-empty id, slug, name, and version', () => {
    ALL_MCP_SERVERS.forEach(s => {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.slug.length).toBeGreaterThan(0);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.version.length).toBeGreaterThan(0);
    });
  });

  it('all slugs are unique', () => {
    const slugs = ALL_MCP_SERVERS.map(s => s.slug);
    expect(new Set(slugs).size).toBe(15);
  });

  it('all ids are unique', () => {
    const ids = ALL_MCP_SERVERS.map(s => s.id);
    expect(new Set(ids).size).toBe(15);
  });

  const expectedSlugs = [
    'social-mcp', 'booking-mcp', 'customer-mcp', 'teacher-mcp',
    'learning-mcp', 'marketing-mcp', 'finance-mcp', 'content-mcp',
    'analytics-mcp', 'workflow-mcp', 'knowledge-mcp', 'admin-mcp',
    'student-mcp', 'notification-mcp', 'campaign-mcp',
  ];

  it.each(expectedSlugs)('registers slug: %s', slug => {
    expect(ALL_MCP_SERVERS.some(s => s.slug === slug)).toBe(true);
  });

  it('every server has at least one backing service', () => {
    ALL_MCP_SERVERS.forEach(s => {
      expect(s.backingServices.length).toBeGreaterThan(0);
    });
  });

  it('every server availability is a known value', () => {
    const known = ['official', 'community', 'custom', 'none'];
    ALL_MCP_SERVERS.forEach(s => {
      expect(known).toContain(s.availability);
    });
  });
});

// ── Per-server tool counts ────────────────────────────────────────────────────

describe('per-server tool counts', () => {
  const EXPECTED: Record<string, number> = {
    'social-mcp':        15,
    'booking-mcp':        8,
    'customer-mcp':       8,
    'teacher-mcp':        8,
    'learning-mcp':       7,
    'marketing-mcp':      9,
    'finance-mcp':        8,
    'content-mcp':        8,
    'analytics-mcp':      8,
    'workflow-mcp':       7,
    'knowledge-mcp':      7,
    'admin-mcp':          8,
    'student-mcp':       10,
    'notification-mcp':  11,
    'campaign-mcp':      12,
  };

  Object.entries(EXPECTED).forEach(([slug, count]) => {
    it(`${slug} has ${count} tools`, () => {
      const server = ALL_MCP_SERVERS.find(s => s.slug === slug);
      expect(server).toBeDefined();
      expect(server!.tools).toHaveLength(count);
    });
  });

  it('total tool count across all servers is 134', () => {
    const total = ALL_MCP_SERVERS.reduce((sum, s) => sum + s.tools.length, 0);
    expect(total).toBe(134);
  });
});

// ── Tool catalog integrity ────────────────────────────────────────────────────

describe('tool catalog integrity', () => {
  const allTools = ALL_MCP_SERVERS.flatMap(s => s.tools);

  it('all tool names are unique across all servers', () => {
    const names = allTools.map(t => t.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toHaveLength(0);
  });

  it('all tools have a non-empty name and description', () => {
    allTools.forEach(t => {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    });
  });

  it('all tools have riskLevel between 1 and 5', () => {
    allTools.forEach(t => {
      expect(t.riskLevel).toBeGreaterThanOrEqual(1);
      expect(t.riskLevel).toBeLessThanOrEqual(5);
    });
  });

  it('all tool tiers are valid McpApprovalTier values', () => {
    const validTiers = ['auto', 'staff', 'customer_confirm', 'staff_approval', 'admin', 'admin_destructive'];
    allTools.forEach(t => {
      expect(validTiers).toContain(t.tier);
    });
  });

  it('all tools have a non-empty inputSchema', () => {
    allTools.forEach(t => {
      expect(t.inputSchema).toBeDefined();
      expect(typeof t.inputSchema).toBe('object');
    });
  });
});

// ── Approval policy ───────────────────────────────────────────────────────────

describe('approval policy classification', () => {
  it('total approval-required tools is 24', () => {
    const routes = getAllApprovalRequiredTools();
    expect(routes).toHaveLength(24);
  });

  it('all returned routes have requiresApproval = true', () => {
    getAllApprovalRequiredTools().forEach(r => {
      expect(r.requiresApproval).toBe(true);
      expect(requiresApproval(r.tier)).toBe(true);
    });
  });

  it('analytics-mcp has no approval-required tools', () => {
    const server = ALL_MCP_SERVERS.find(s => s.slug === 'analytics-mcp')!;
    const approvalTools = server.tools.filter(t => requiresApproval(t.tier));
    expect(approvalTools).toHaveLength(0);
  });

  it('knowledge-mcp has no approval-required tools', () => {
    const server = ALL_MCP_SERVERS.find(s => s.slug === 'knowledge-mcp')!;
    const approvalTools = server.tools.filter(t => requiresApproval(t.tier));
    expect(approvalTools).toHaveLength(0);
  });

  it('auto tier tools are never marked requiresApproval', () => {
    const allTools = ALL_MCP_SERVERS.flatMap(s => s.tools);
    allTools.filter(t => t.tier === 'auto').forEach(t => {
      expect(requiresApproval(t.tier)).toBe(false);
    });
  });

  it('admin_destructive tools always require approval', () => {
    const allTools = ALL_MCP_SERVERS.flatMap(s => s.tools);
    allTools.filter(t => t.tier === 'admin_destructive').forEach(t => {
      expect(requiresApproval(t.tier)).toBe(true);
    });
  });

  it('high-risk (riskLevel >= 4) tools all have approval-requiring tiers', () => {
    const routes = getAllHighRiskRoutes(4);
    expect(routes.length).toBeGreaterThan(0);
    routes.forEach(r => {
      expect(requiresApproval(r.tier)).toBe(true);
    });
  });
});

// ── Specific high-risk tools ──────────────────────────────────────────────────

describe('specific high-risk and destructive tools', () => {
  it('delete_customer_data has tier admin_destructive and riskLevel 5', () => {
    const r = routeTool('delete_customer_data');
    expect(r).toBeDefined();
    expect(r!.tier).toBe('admin_destructive');
    expect(r!.riskLevel).toBe(5);
    expect(r!.server.slug).toBe('customer-mcp');
  });

  it('update_pricing has tier admin_destructive', () => {
    const r = routeTool('update_pricing');
    expect(r).toBeDefined();
    expect(r!.tier).toBe('admin_destructive');
    expect(r!.server.slug).toBe('finance-mcp');
  });

  it('update_config (admin-mcp) has tier admin_destructive', () => {
    const r = routeTool('update_config');
    expect(r).toBeDefined();
    expect(r!.tier).toBe('admin_destructive');
    expect(r!.server.slug).toBe('admin-mcp');
  });

  it('approve_refund has tier admin and riskLevel 5', () => {
    const r = routeTool('approve_refund');
    expect(r).toBeDefined();
    expect(r!.tier).toBe('admin');
    expect(r!.riskLevel).toBe(5);
    expect(r!.server.slug).toBe('finance-mcp');
  });

  it('publish_video requires staff_approval', () => {
    const r = routeTool('publish_video');
    expect(r).toBeDefined();
    expect(r!.tier).toBe('staff_approval');
  });

  it('publish_post requires admin approval', () => {
    const r = routeTool('publish_post');
    expect(r).toBeDefined();
    expect(r!.tier).toBe('admin');
    expect(r!.requiresApproval).toBe(true);
  });

  it('sparql_query is staff tier (not admin)', () => {
    const r = routeTool('sparql_query');
    expect(r).toBeDefined();
    expect(r!.tier).toBe('staff');
    expect(r!.requiresApproval).toBe(false);
  });
});

// ── routeTool() ───────────────────────────────────────────────────────────────

describe('routeTool()', () => {
  it('returns undefined for unknown tool names', () => {
    expect(routeTool('nonexistent_tool')).toBeUndefined();
  });

  it('returns correct server for known tool', () => {
    const r = routeTool('create_booking');
    expect(r).toBeDefined();
    expect(r!.server.slug).toBe('booking-mcp');
  });

  it('returns correct server for get_service_health', () => {
    const r = routeTool('get_service_health');
    expect(r!.server.slug).toBe('admin-mcp');
    expect(r!.tier).toBe('auto');
    expect(r!.requiresApproval).toBe(false);
  });

  it('requiresApproval is false for auto-tier tools', () => {
    const r = routeTool('get_funnel_metrics');
    expect(r!.tier).toBe('auto');
    expect(r!.requiresApproval).toBe(false);
  });
});

// ── getToolTier() ─────────────────────────────────────────────────────────────

describe('getToolTier()', () => {
  it('returns correct tier for a known tool', () => {
    expect(getToolTier('get_service_health')).toBe('auto');
  });

  it('throws for unknown tool', () => {
    expect(() => getToolTier('does_not_exist')).toThrow('Unknown MCP tool: does_not_exist');
  });
});

// ── getServer() ───────────────────────────────────────────────────────────────

describe('getServer()', () => {
  it('finds server by slug', () => {
    const s = getServer('admin-mcp');
    expect(s).toBeDefined();
    expect(s!.name).toBe('Admin MCP');
  });

  it('returns undefined for unknown slug', () => {
    expect(getServer('not-a-server')).toBeUndefined();
  });
});

// ── buildGatewaySummary() ─────────────────────────────────────────────────────

describe('buildGatewaySummary()', () => {
  let summary: ReturnType<typeof buildGatewaySummary>;
  beforeEach(() => { summary = buildGatewaySummary(); });

  it('serverCount is 15', () => {
    expect(summary.serverCount).toBe(15);
  });

  it('totalTools is 134', () => {
    expect(summary.totalTools).toBe(134);
  });

  it('approvalRequiredTools is 24', () => {
    expect(summary.approvalRequiredTools).toBe(24);
  });

  it('highRiskToolCount is greater than 0', () => {
    expect(summary.highRiskToolCount).toBeGreaterThan(0);
  });

  it('tierBreakdown sums to totalTools', () => {
    const sumTiers = Object.values(summary.tierBreakdown).reduce((a, b) => a + b, 0);
    expect(sumTiers).toBe(summary.totalTools);
  });

  it('servers array has 15 entries', () => {
    expect(summary.servers).toHaveLength(15);
  });

  it('each server entry has id, name, toolCount, approvalRequiredCount', () => {
    summary.servers.forEach(s => {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.toolCount).toBeGreaterThan(0);
      expect(s.approvalRequiredCount).toBeGreaterThanOrEqual(0);
    });
  });

  it('sum of server toolCounts equals totalTools', () => {
    const sum = summary.servers.reduce((acc, s) => acc + s.toolCount, 0);
    expect(sum).toBe(summary.totalTools);
  });

  it('sum of server approvalRequiredCounts equals approvalRequiredTools', () => {
    const sum = summary.servers.reduce((acc, s) => acc + s.approvalRequiredCount, 0);
    expect(sum).toBe(summary.approvalRequiredTools);
  });
});
