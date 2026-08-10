import { describe, it, expect } from '@jest/globals';
import { WellnessMcpRegistry, type McpTier } from '../../../domain/wellness/WellnessMcpRegistry';

const registry = new WellnessMcpRegistry();

// ── Catalogue ─────────────────────────────────────────────────────────────────

describe('WellnessMcpRegistry — catalogue', () => {
  it('exposes 13 tools total', () => {
    expect(registry.getAll()).toHaveLength(13);
  });

  it('includes first and last tools', () => {
    const names = registry.getAll().map(t => t.name);
    expect(names).toContain('get_wellness_summary');
    expect(names).toContain('delete_health_profile');
  });

  it('get() returns correct tool', () => {
    const tool = registry.get('log_body_metrics');
    expect(tool.name).toBe('log_body_metrics');
    expect(tool.tier).toBe('staff');
  });

  it('get() throws for unknown tool', () => {
    expect(() => registry.get('nonexistent')).toThrow('not found');
  });
});

// ── Tier distribution ─────────────────────────────────────────────────────────

describe('tier distribution', () => {
  const tiers: Record<McpTier, number> = {
    auto:              2,
    staff:             5,
    customer_confirm:  1,
    staff_approval:    2,
    admin:             2,
    admin_destructive: 1,
  };

  Object.entries(tiers).forEach(([tier, count]) => {
    it(`has ${count} ${tier} tool(s)`, () => {
      expect(registry.byTier(tier as McpTier)).toHaveLength(count);
    });
  });
});

// ── Safety requirements ───────────────────────────────────────────────────────

describe('safety requirements', () => {
  it('admin_destructive tool has both confirmText and confirmApprovalId', () => {
    registry.byTier('admin_destructive').forEach(t => {
      expect(t.confirmText).toBeDefined();
      expect(t.confirmApprovalId).toBe(true);
    });
  });

  it('staff_approval tools have confirmApprovalId', () => {
    registry.byTier('staff_approval').forEach(t => {
      expect(t.confirmApprovalId).toBe(true);
    });
  });

  it('customer_confirm tool has confirmText', () => {
    registry.byTier('customer_confirm').forEach(t => {
      expect(t.confirmText).toBeDefined();
    });
  });

  it('auto tools have no confirm requirements', () => {
    registry.byTier('auto').forEach(t => {
      expect(t.confirmText).toBeUndefined();
      expect(t.confirmApprovalId).toBeUndefined();
    });
  });

  it('reset_wellness_log confirmText is RESET_WELLNESS', () => {
    expect(registry.get('reset_wellness_log').confirmText).toBe('RESET_WELLNESS');
  });

  it('delete_health_profile confirmText is DELETE_HEALTH_PROFILE', () => {
    expect(registry.get('delete_health_profile').confirmText).toBe('DELETE_HEALTH_PROFILE');
  });

  it('get_health_profile has safetyNote about sensitive PII', () => {
    expect(registry.get('get_health_profile').safetyNote).toBeTruthy();
  });

  it('export_health_data has safetyNote', () => {
    expect(registry.get('export_health_data').safetyNote).toBeTruthy();
  });

  it('delete_health_profile has safetyNote', () => {
    expect(registry.get('delete_health_profile').safetyNote).toBeTruthy();
  });
});

// ── execute() — auto ──────────────────────────────────────────────────────────

describe('execute() — auto tier', () => {
  it('executes get_wellness_summary', () => {
    expect(registry.execute('get_wellness_summary', {}).tool.tier).toBe('auto');
  });

  it('executes get_body_metrics_history', () => {
    expect(registry.execute('get_body_metrics_history', {}).tool.tier).toBe('auto');
  });
});

// ── execute() — staff ─────────────────────────────────────────────────────────

describe('execute() — staff tier', () => {
  it('executes log_body_metrics', () => {
    expect(registry.execute('log_body_metrics', { customerId: 'c1' }).tool.tier).toBe('staff');
  });

  it('executes log_daily_wellness', () => {
    expect(registry.execute('log_daily_wellness', { customerId: 'c1' }).tool.tier).toBe('staff');
  });

  it('executes update_fitness_level', () => {
    expect(registry.execute('update_fitness_level', { level: 'moderate' }).tool.tier).toBe('staff');
  });

  it('executes connect_wearable', () => {
    expect(registry.execute('connect_wearable', { platform: 'fitbit' }).tool.name).toBe('connect_wearable');
  });

  it('executes get_wellness_report', () => {
    expect(registry.execute('get_wellness_report', { customerId: 'c1' }).tool.tier).toBe('staff');
  });
});

// ── execute() — customer_confirm ─────────────────────────────────────────────

describe('execute() — customer_confirm', () => {
  it('executes with correct confirmText', () => {
    const result = registry.execute('reset_wellness_log', { confirmText: 'RESET_WELLNESS' });
    expect(result.tool.tier).toBe('customer_confirm');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('reset_wellness_log', {})).toThrow('confirmText is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('reset_wellness_log', { confirmText: 'RESET' }))
      .toThrow('"RESET_WELLNESS"');
  });
});

// ── execute() — staff_approval ────────────────────────────────────────────────

describe('execute() — staff_approval', () => {
  it('executes get_health_profile with confirmApprovalId', () => {
    const result = registry.execute('get_health_profile', { confirmApprovalId: 'APR-1' });
    expect(result.tool.tier).toBe('staff_approval');
  });

  it('throws when confirmApprovalId missing for get_health_profile', () => {
    expect(() => registry.execute('get_health_profile', {})).toThrow('confirmApprovalId is required');
  });

  it('executes export_health_data with confirmApprovalId', () => {
    expect(registry.execute('export_health_data', { confirmApprovalId: 'A1' }).tool.name)
      .toBe('export_health_data');
  });

  it('throws when confirmApprovalId missing for export_health_data', () => {
    expect(() => registry.execute('export_health_data', {})).toThrow('confirmApprovalId is required');
  });
});

// ── execute() — admin ─────────────────────────────────────────────────────────

describe('execute() — admin tier', () => {
  it('executes bulk_wellness_report', () => {
    expect(registry.execute('bulk_wellness_report', {}).tool.tier).toBe('admin');
  });

  it('executes get_wellness_analytics', () => {
    expect(registry.execute('get_wellness_analytics', {}).tool.tier).toBe('admin');
  });
});

// ── execute() — admin_destructive ─────────────────────────────────────────────

describe('execute() — admin_destructive', () => {
  it('executes with both confirmText and confirmApprovalId', () => {
    const result = registry.execute('delete_health_profile', {
      confirmText:       'DELETE_HEALTH_PROFILE',
      confirmApprovalId: 'APR-99',
    });
    expect(result.tool.tier).toBe('admin_destructive');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('delete_health_profile', { confirmApprovalId: 'A1' }))
      .toThrow('confirmText is required');
  });

  it('throws when confirmApprovalId missing', () => {
    expect(() => registry.execute('delete_health_profile', { confirmText: 'DELETE_HEALTH_PROFILE' }))
      .toThrow('confirmApprovalId is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('delete_health_profile', { confirmText: 'WRONG', confirmApprovalId: 'A1' }))
      .toThrow('"DELETE_HEALTH_PROFILE"');
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('execute() throws on empty name', () => {
    expect(() => registry.execute('', {})).toThrow('tool name is required');
  });

  it('execute() throws on unknown tool name', () => {
    expect(() => registry.execute('nonexistent', {})).toThrow('not found');
  });

  it('getAll() returns defensive copy', () => {
    const all = registry.getAll();
    all.push({ name: 'spy', tier: 'auto', description: 'spy' });
    expect(registry.getAll()).toHaveLength(13);
  });
});
