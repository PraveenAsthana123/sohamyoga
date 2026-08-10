import { describe, it, expect } from '@jest/globals';
import { YogaMcpRegistry, type McpTier } from '../../../domain/yoga/YogaMcpRegistry';

const registry = new YogaMcpRegistry();

// ── Catalogue ─────────────────────────────────────────────────────────────────

describe('YogaMcpRegistry — catalogue', () => {
  it('exposes 13 tools total', () => {
    expect(registry.getAll()).toHaveLength(13);
  });

  it('includes first and last tools', () => {
    const names = registry.getAll().map(t => t.name);
    expect(names).toContain('search_asana');
    expect(names).toContain('delete_asana');
  });

  it('get() returns correct tool', () => {
    const tool = registry.get('create_sequence');
    expect(tool.name).toBe('create_sequence');
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

  it('save_to_practice_plan confirmText is SAVE_TO_PLAN', () => {
    expect(registry.get('save_to_practice_plan').confirmText).toBe('SAVE_TO_PLAN');
  });

  it('delete_asana confirmText is DELETE_ASANA', () => {
    expect(registry.get('delete_asana').confirmText).toBe('DELETE_ASANA');
  });

  it('bulk_import_library has safetyNote', () => {
    expect(registry.get('bulk_import_library').safetyNote).toBeTruthy();
  });

  it('export_library_data has safetyNote', () => {
    expect(registry.get('export_library_data').safetyNote).toBeTruthy();
  });

  it('delete_asana has safetyNote', () => {
    expect(registry.get('delete_asana').safetyNote).toBeTruthy();
  });
});

// ── execute() — auto ──────────────────────────────────────────────────────────

describe('execute() — auto', () => {
  it('executes search_asana', () => {
    expect(registry.execute('search_asana', { q: 'warrior' }).tool.tier).toBe('auto');
  });

  it('executes search_meditation', () => {
    expect(registry.execute('search_meditation', { style: 'yoga_nidra' }).tool.tier).toBe('auto');
  });
});

// ── execute() — staff ─────────────────────────────────────────────────────────

describe('execute() — staff', () => {
  it('executes create_asana', () => {
    expect(registry.execute('create_asana', { englishName: 'Warrior I' }).tool.tier).toBe('staff');
  });

  it('executes update_asana', () => {
    expect(registry.execute('update_asana', { asanaId: 'a1' }).tool.tier).toBe('staff');
  });

  it('executes create_sequence', () => {
    expect(registry.execute('create_sequence', { title: 'Morning Flow' }).tool.name).toBe('create_sequence');
  });

  it('executes create_pranayama', () => {
    expect(registry.execute('create_pranayama', { englishName: 'Box Breathing' }).tool.tier).toBe('staff');
  });

  it('executes publish_meditation', () => {
    expect(registry.execute('publish_meditation', { id: 'm1' }).tool.tier).toBe('staff');
  });
});

// ── execute() — customer_confirm ─────────────────────────────────────────────

describe('execute() — customer_confirm', () => {
  it('executes with correct confirmText', () => {
    const r = registry.execute('save_to_practice_plan', { confirmText: 'SAVE_TO_PLAN' });
    expect(r.tool.tier).toBe('customer_confirm');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('save_to_practice_plan', {})).toThrow('confirmText is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('save_to_practice_plan', { confirmText: 'SAVE' }))
      .toThrow('"SAVE_TO_PLAN"');
  });
});

// ── execute() — staff_approval ────────────────────────────────────────────────

describe('execute() — staff_approval', () => {
  it('executes bulk_import_library with confirmApprovalId', () => {
    expect(registry.execute('bulk_import_library', { confirmApprovalId: 'APR-1' }).tool.tier)
      .toBe('staff_approval');
  });

  it('throws when confirmApprovalId missing', () => {
    expect(() => registry.execute('bulk_import_library', {})).toThrow('confirmApprovalId is required');
  });

  it('executes export_library_data with confirmApprovalId', () => {
    expect(registry.execute('export_library_data', { confirmApprovalId: 'A1' }).tool.name)
      .toBe('export_library_data');
  });
});

// ── execute() — admin ─────────────────────────────────────────────────────────

describe('execute() — admin', () => {
  it('executes publish_sequence_template', () => {
    expect(registry.execute('publish_sequence_template', { seqId: 's1' }).tool.tier).toBe('admin');
  });

  it('executes archive_asana', () => {
    expect(registry.execute('archive_asana', { asanaId: 'a1' }).tool.tier).toBe('admin');
  });
});

// ── execute() — admin_destructive ─────────────────────────────────────────────

describe('execute() — admin_destructive', () => {
  it('executes with both confirmText and confirmApprovalId', () => {
    const r = registry.execute('delete_asana', {
      confirmText:       'DELETE_ASANA',
      confirmApprovalId: 'APR-99',
    });
    expect(r.tool.tier).toBe('admin_destructive');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('delete_asana', { confirmApprovalId: 'A1' }))
      .toThrow('confirmText is required');
  });

  it('throws when confirmApprovalId missing', () => {
    expect(() => registry.execute('delete_asana', { confirmText: 'DELETE_ASANA' }))
      .toThrow('confirmApprovalId is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('delete_asana', { confirmText: 'DELETE', confirmApprovalId: 'A1' }))
      .toThrow('"DELETE_ASANA"');
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
