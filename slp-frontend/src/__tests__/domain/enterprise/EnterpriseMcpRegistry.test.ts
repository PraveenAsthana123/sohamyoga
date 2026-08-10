import { describe, it, expect } from '@jest/globals';
import { EnterpriseMcpRegistry, type McpTier } from '../../../domain/enterprise/EnterpriseMcpRegistry';

const registry = new EnterpriseMcpRegistry();

// ── Catalogue ─────────────────────────────────────────────────────────────────

describe('EnterpriseMcpRegistry — catalogue', () => {
  it('exposes 13 tools total', () => {
    expect(registry.getAll()).toHaveLength(13);
  });

  it('includes first and last tools', () => {
    const names = registry.getAll().map(t => t.name);
    expect(names).toContain('get_branch_info');
    expect(names).toContain('terminate_franchise_agreement');
  });

  it('get() returns correct tool', () => {
    const tool = registry.get('invite_franchisee');
    expect(tool.name).toBe('invite_franchisee');
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

  it('accept_franchise_terms confirmText is ACCEPT_TERMS', () => {
    expect(registry.get('accept_franchise_terms').confirmText).toBe('ACCEPT_TERMS');
  });

  it('terminate_franchise_agreement confirmText is TERMINATE_AGREEMENT', () => {
    expect(registry.get('terminate_franchise_agreement').confirmText).toBe('TERMINATE_AGREEMENT');
  });

  it('approve_branch_setup has safetyNote', () => {
    expect(registry.get('approve_branch_setup').safetyNote).toBeTruthy();
  });

  it('export_franchise_data has safetyNote', () => {
    expect(registry.get('export_franchise_data').safetyNote).toBeTruthy();
  });

  it('terminate_franchise_agreement has safetyNote', () => {
    expect(registry.get('terminate_franchise_agreement').safetyNote).toBeTruthy();
  });
});

// ── execute() — auto ──────────────────────────────────────────────────────────

describe('execute() — auto', () => {
  it('executes get_branch_info', () => {
    expect(registry.execute('get_branch_info', { branchId: 'b1' }).tool.tier).toBe('auto');
  });

  it('executes search_corporate_programs', () => {
    expect(registry.execute('search_corporate_programs', { q: 'acme' }).tool.tier).toBe('auto');
  });
});

// ── execute() — staff ─────────────────────────────────────────────────────────

describe('execute() — staff', () => {
  it('executes create_branch', () => {
    expect(registry.execute('create_branch', { name: 'Downtown' }).tool.tier).toBe('staff');
  });

  it('executes update_branch', () => {
    expect(registry.execute('update_branch', { branchId: 'b1' }).tool.tier).toBe('staff');
  });

  it('executes create_corporate_program', () => {
    expect(registry.execute('create_corporate_program', { corp: 'Acme' }).tool.name)
      .toBe('create_corporate_program');
  });

  it('executes update_white_label', () => {
    expect(registry.execute('update_white_label', { tenantId: 't1' }).tool.tier).toBe('staff');
  });

  it('executes invite_franchisee', () => {
    expect(registry.execute('invite_franchisee', { email: 'x@y.com' }).tool.tier).toBe('staff');
  });
});

// ── execute() — customer_confirm ─────────────────────────────────────────────

describe('execute() — customer_confirm', () => {
  it('executes with correct confirmText', () => {
    const r = registry.execute('accept_franchise_terms', { confirmText: 'ACCEPT_TERMS' });
    expect(r.tool.tier).toBe('customer_confirm');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('accept_franchise_terms', {})).toThrow('confirmText is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('accept_franchise_terms', { confirmText: 'ACCEPT' }))
      .toThrow('"ACCEPT_TERMS"');
  });
});

// ── execute() — staff_approval ────────────────────────────────────────────────

describe('execute() — staff_approval', () => {
  it('executes approve_branch_setup with confirmApprovalId', () => {
    expect(registry.execute('approve_branch_setup', { confirmApprovalId: 'APR-1' }).tool.tier)
      .toBe('staff_approval');
  });

  it('throws when confirmApprovalId missing', () => {
    expect(() => registry.execute('approve_branch_setup', {})).toThrow('confirmApprovalId is required');
  });

  it('executes export_franchise_data with confirmApprovalId', () => {
    expect(registry.execute('export_franchise_data', { confirmApprovalId: 'A1' }).tool.name)
      .toBe('export_franchise_data');
  });
});

// ── execute() — admin ─────────────────────────────────────────────────────────

describe('execute() — admin', () => {
  it('executes activate_white_label', () => {
    expect(registry.execute('activate_white_label', { tenantId: 't1' }).tool.tier).toBe('admin');
  });

  it('executes suspend_branch', () => {
    expect(registry.execute('suspend_branch', { branchId: 'b1' }).tool.tier).toBe('admin');
  });
});

// ── execute() — admin_destructive ─────────────────────────────────────────────

describe('execute() — admin_destructive', () => {
  it('executes with both confirmText and confirmApprovalId', () => {
    const r = registry.execute('terminate_franchise_agreement', {
      confirmText:       'TERMINATE_AGREEMENT',
      confirmApprovalId: 'APR-99',
    });
    expect(r.tool.tier).toBe('admin_destructive');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('terminate_franchise_agreement', { confirmApprovalId: 'A1' }))
      .toThrow('confirmText is required');
  });

  it('throws when confirmApprovalId missing', () => {
    expect(() => registry.execute('terminate_franchise_agreement', { confirmText: 'TERMINATE_AGREEMENT' }))
      .toThrow('confirmApprovalId is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('terminate_franchise_agreement', {
      confirmText: 'TERMINATE', confirmApprovalId: 'A1'
    })).toThrow('"TERMINATE_AGREEMENT"');
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('execute() throws on empty name', () => {
    expect(() => registry.execute('', {})).toThrow('tool name is required');
  });

  it('execute() throws on unknown tool', () => {
    expect(() => registry.execute('nonexistent', {})).toThrow('not found');
  });

  it('getAll() returns defensive copy', () => {
    const all = registry.getAll();
    all.push({ name: 'spy', tier: 'auto', description: 'spy' });
    expect(registry.getAll()).toHaveLength(13);
  });
});
