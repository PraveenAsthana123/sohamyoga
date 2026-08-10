import { describe, it, expect } from '@jest/globals';
import { JourneyMcpRegistry, type McpTier } from '../../../domain/journey/JourneyMcpRegistry';

const registry = new JourneyMcpRegistry();

// ── Catalogue ─────────────────────────────────────────────────────────────────

describe('JourneyMcpRegistry — catalogue', () => {
  it('exposes 13 tools total', () => {
    expect(registry.getAll()).toHaveLength(13);
  });

  it('includes first and last tools', () => {
    const names = registry.getAll().map(t => t.name);
    expect(names).toContain('get_journey_summary');
    expect(names).toContain('delete_journey_data');
  });

  it('get() returns correct tool', () => {
    const tool = registry.get('advance_journey_phase');
    expect(tool.name).toBe('advance_journey_phase');
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
  it('admin_destructive tool has confirmText AND confirmApprovalId', () => {
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

  it('reset_journey confirmText is RESET_JOURNEY', () => {
    expect(registry.get('reset_journey').confirmText).toBe('RESET_JOURNEY');
  });

  it('delete_journey_data confirmText is DELETE_JOURNEY', () => {
    expect(registry.get('delete_journey_data').confirmText).toBe('DELETE_JOURNEY');
  });

  it('get_health_profile has safetyNote', () => {
    expect(registry.get('get_health_profile').safetyNote).toBeTruthy();
  });

  it('delete_journey_data has safetyNote', () => {
    expect(registry.get('delete_journey_data').safetyNote).toBeTruthy();
  });
});

// ── execute() — auto ──────────────────────────────────────────────────────────

describe('execute() — auto tier', () => {
  it('executes get_journey_summary', () => {
    expect(registry.execute('get_journey_summary', {}).tool.tier).toBe('auto');
  });

  it('executes get_milestone_stats', () => {
    expect(registry.execute('get_milestone_stats', {}).tool.tier).toBe('auto');
  });
});

// ── execute() — staff ─────────────────────────────────────────────────────────

describe('execute() — staff tier', () => {
  it('executes get_customer_journey', () => {
    expect(registry.execute('get_customer_journey', { customerId: 'c1' }).tool.tier).toBe('staff');
  });

  it('executes advance_journey_phase', () => {
    expect(registry.execute('advance_journey_phase', { journeyId: 'j1' }).tool.tier).toBe('staff');
  });

  it('executes award_milestone', () => {
    expect(registry.execute('award_milestone', { customerId: 'c1' }).tool.name).toBe('award_milestone');
  });

  it('executes update_weekly_target', () => {
    expect(registry.execute('update_weekly_target', { minutes: 120 }).tool.tier).toBe('staff');
  });

  it('executes get_habit_report', () => {
    expect(registry.execute('get_habit_report', { customerId: 'c1' }).tool.tier).toBe('staff');
  });
});

// ── execute() — customer_confirm ─────────────────────────────────────────────

describe('execute() — customer_confirm', () => {
  it('executes with correct confirmText', () => {
    const result = registry.execute('reset_journey', { confirmText: 'RESET_JOURNEY' });
    expect(result.tool.tier).toBe('customer_confirm');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('reset_journey', {})).toThrow('confirmText is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('reset_journey', { confirmText: 'RESET' }))
      .toThrow('"RESET_JOURNEY"');
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

  it('executes export_journey_data with confirmApprovalId', () => {
    expect(registry.execute('export_journey_data', { confirmApprovalId: 'A1' }).tool.name)
      .toBe('export_journey_data');
  });
});

// ── execute() — admin ─────────────────────────────────────────────────────────

describe('execute() — admin tier', () => {
  it('executes bulk_award_milestones', () => {
    expect(registry.execute('bulk_award_milestones', { criteria: 'anniversary' }).tool.tier).toBe('admin');
  });

  it('executes get_journey_analytics', () => {
    expect(registry.execute('get_journey_analytics', {}).tool.tier).toBe('admin');
  });
});

// ── execute() — admin_destructive ─────────────────────────────────────────────

describe('execute() — admin_destructive', () => {
  it('executes with both confirmText and confirmApprovalId', () => {
    const result = registry.execute('delete_journey_data', {
      confirmText:       'DELETE_JOURNEY',
      confirmApprovalId: 'APR-99',
    });
    expect(result.tool.tier).toBe('admin_destructive');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('delete_journey_data', { confirmApprovalId: 'A1' }))
      .toThrow('confirmText is required');
  });

  it('throws when confirmApprovalId missing', () => {
    expect(() => registry.execute('delete_journey_data', { confirmText: 'DELETE_JOURNEY' }))
      .toThrow('confirmApprovalId is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('delete_journey_data', { confirmText: 'WRONG', confirmApprovalId: 'A1' }))
      .toThrow('"DELETE_JOURNEY"');
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('execute() throws on empty name', () => {
    expect(() => registry.execute('', {})).toThrow('tool name is required');
  });

  it('execute() throws on unknown name', () => {
    expect(() => registry.execute('nonexistent', {})).toThrow('not found');
  });

  it('getAll returns defensive copy', () => {
    const all = registry.getAll();
    all.push({ name: 'spy', tier: 'auto', description: 'spy' });
    expect(registry.getAll()).toHaveLength(13);
  });
});
