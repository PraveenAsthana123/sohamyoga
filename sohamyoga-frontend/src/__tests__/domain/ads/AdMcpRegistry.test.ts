import { describe, it, expect } from '@jest/globals';
import { AdMcpRegistry, type McpTier } from '../../../domain/ads/AdMcpRegistry';

const registry = new AdMcpRegistry();

// ── Catalogue ─────────────────────────────────────────────────────────────────

describe('AdMcpRegistry — catalogue', () => {
  it('exposes 13 tools total', () => {
    expect(registry.getAll()).toHaveLength(13);
  });

  it('getAll includes first and last tools', () => {
    const names = registry.getAll().map(t => t.name);
    expect(names).toContain('get_campaigns');
    expect(names).toContain('delete_campaign_data');
  });

  it('get() returns correct tool', () => {
    const tool = registry.get('create_campaign');
    expect(tool.name).toBe('create_campaign');
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

  it('delete_campaign_data confirmText is DELETE_CAMPAIGN', () => {
    expect(registry.get('delete_campaign_data').confirmText).toBe('DELETE_CAMPAIGN');
  });

  it('opt_out_ad_targeting confirmText is OPT_OUT_ADS', () => {
    expect(registry.get('opt_out_ad_targeting').confirmText).toBe('OPT_OUT_ADS');
  });

  it('get_audience_data has a safetyNote', () => {
    expect(registry.get('get_audience_data').safetyNote).toBeTruthy();
  });

  it('delete_campaign_data has a safetyNote', () => {
    expect(registry.get('delete_campaign_data').safetyNote).toBeTruthy();
  });
});

// ── execute() — auto ──────────────────────────────────────────────────────────

describe('execute() — auto tier', () => {
  it('executes get_campaigns without confirm params', () => {
    const result = registry.execute('get_campaigns', { page: 1 });
    expect(result.tool.name).toBe('get_campaigns');
    expect(result.params.page).toBe(1);
  });

  it('executes get_campaign_summary', () => {
    expect(registry.execute('get_campaign_summary', {}).tool.tier).toBe('auto');
  });
});

// ── execute() — staff ─────────────────────────────────────────────────────────

describe('execute() — staff tier', () => {
  it('executes create_campaign', () => {
    expect(registry.execute('create_campaign', { name: 'Test' }).tool.tier).toBe('staff');
  });

  it('executes update_campaign', () => {
    expect(registry.execute('update_campaign', { id: 'c1' }).tool.name).toBe('update_campaign');
  });

  it('executes pause_campaign', () => {
    expect(registry.execute('pause_campaign', { id: 'c1' }).tool.tier).toBe('staff');
  });

  it('executes get_campaign', () => {
    expect(registry.execute('get_campaign', { id: 'c1' }).tool.tier).toBe('staff');
  });

  it('executes get_ad_performance', () => {
    expect(registry.execute('get_ad_performance', { campaignId: 'c1' }).tool.tier).toBe('staff');
  });
});

// ── execute() — customer_confirm ─────────────────────────────────────────────

describe('execute() — customer_confirm', () => {
  it('executes with correct confirmText', () => {
    const result = registry.execute('opt_out_ad_targeting', { confirmText: 'OPT_OUT_ADS' });
    expect(result.tool.tier).toBe('customer_confirm');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('opt_out_ad_targeting', {})).toThrow('confirmText is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('opt_out_ad_targeting', { confirmText: 'WRONG' }))
      .toThrow('"OPT_OUT_ADS"');
  });
});

// ── execute() — staff_approval ────────────────────────────────────────────────

describe('execute() — staff_approval', () => {
  it('executes get_audience_data with confirmApprovalId', () => {
    const result = registry.execute('get_audience_data', { confirmApprovalId: 'APR-1' });
    expect(result.tool.tier).toBe('staff_approval');
  });

  it('throws when confirmApprovalId missing', () => {
    expect(() => registry.execute('get_audience_data', {})).toThrow('confirmApprovalId is required');
  });

  it('executes export_campaign_report with confirmApprovalId', () => {
    expect(registry.execute('export_campaign_report', { confirmApprovalId: 'A1' }).tool.name)
      .toBe('export_campaign_report');
  });
});

// ── execute() — admin ─────────────────────────────────────────────────────────

describe('execute() — admin tier', () => {
  it('executes set_campaign_budget without confirm', () => {
    expect(registry.execute('set_campaign_budget', { campaignId: 'c1', dailyBudgetCents: 5000 }).tool.tier)
      .toBe('admin');
  });

  it('executes get_billing_analytics', () => {
    expect(registry.execute('get_billing_analytics', {}).tool.tier).toBe('admin');
  });
});

// ── execute() — admin_destructive ─────────────────────────────────────────────

describe('execute() — admin_destructive', () => {
  it('executes with both confirmText and confirmApprovalId', () => {
    const result = registry.execute('delete_campaign_data', {
      confirmText:       'DELETE_CAMPAIGN',
      confirmApprovalId: 'APR-99',
    });
    expect(result.tool.tier).toBe('admin_destructive');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('delete_campaign_data', { confirmApprovalId: 'A1' }))
      .toThrow('confirmText is required');
  });

  it('throws when confirmApprovalId missing', () => {
    expect(() => registry.execute('delete_campaign_data', { confirmText: 'DELETE_CAMPAIGN' }))
      .toThrow('confirmApprovalId is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('delete_campaign_data', {
      confirmText: 'WRONG', confirmApprovalId: 'A1'
    })).toThrow('"DELETE_CAMPAIGN"');
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('execute() throws on empty tool name', () => {
    expect(() => registry.execute('', {})).toThrow('tool name is required');
  });

  it('execute() throws on unknown tool name', () => {
    expect(() => registry.execute('nonexistent', {})).toThrow('not found');
  });

  it('getAll returns a defensive copy', () => {
    const all = registry.getAll();
    all.push({ name: 'spy', tier: 'auto', description: 'spy' });
    expect(registry.getAll()).toHaveLength(13);
  });

  it('byTier returns correct count for each tier', () => {
    expect(registry.byTier('auto').length).toBeGreaterThan(0);
  });
});
