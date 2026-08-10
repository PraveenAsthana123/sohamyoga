import { describe, it, expect } from '@jest/globals';
import { TeacherMcpRegistry, type McpTier } from '../../../domain/teacher/TeacherMcpRegistry';

const registry = new TeacherMcpRegistry();

// ── Catalogue ─────────────────────────────────────────────────────────────────

describe('TeacherMcpRegistry — catalogue', () => {
  it('exposes 13 tools total', () => {
    expect(registry.getAll()).toHaveLength(13);
  });

  it('includes first and last tools', () => {
    const names = registry.getAll().map(t => t.name);
    expect(names).toContain('get_teacher_directory');
    expect(names).toContain('delete_teacher_profile');
  });

  it('get() returns correct tool', () => {
    const tool = registry.get('add_certification');
    expect(tool.name).toBe('add_certification');
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

  it('book_private_session confirmText is BOOK_PRIVATE', () => {
    expect(registry.get('book_private_session').confirmText).toBe('BOOK_PRIVATE');
  });

  it('delete_teacher_profile confirmText is DELETE_TEACHER', () => {
    expect(registry.get('delete_teacher_profile').confirmText).toBe('DELETE_TEACHER');
  });

  it('get_payroll_data has safetyNote about financial PII', () => {
    expect(registry.get('get_payroll_data').safetyNote).toBeTruthy();
  });

  it('export_teacher_data has safetyNote', () => {
    expect(registry.get('export_teacher_data').safetyNote).toBeTruthy();
  });

  it('delete_teacher_profile has safetyNote', () => {
    expect(registry.get('delete_teacher_profile').safetyNote).toBeTruthy();
  });
});

// ── execute() — auto ──────────────────────────────────────────────────────────

describe('execute() — auto tier', () => {
  it('executes get_teacher_directory', () => {
    expect(registry.execute('get_teacher_directory', {}).tool.tier).toBe('auto');
  });

  it('executes get_teacher_schedule', () => {
    expect(registry.execute('get_teacher_schedule', { teacherId: 't1' }).tool.tier).toBe('auto');
  });
});

// ── execute() — staff ─────────────────────────────────────────────────────────

describe('execute() — staff tier', () => {
  it('executes get_teacher_profile', () => {
    expect(registry.execute('get_teacher_profile', { teacherId: 't1' }).tool.tier).toBe('staff');
  });

  it('executes update_teacher_status', () => {
    expect(registry.execute('update_teacher_status', { status: 'active' }).tool.tier).toBe('staff');
  });

  it('executes add_certification', () => {
    expect(registry.execute('add_certification', { type: 'ryt_200' }).tool.name).toBe('add_certification');
  });

  it('executes get_performance_report', () => {
    expect(registry.execute('get_performance_report', { teacherId: 't1' }).tool.tier).toBe('staff');
  });

  it('executes assign_substitute', () => {
    expect(registry.execute('assign_substitute', { classId: 'c1' }).tool.tier).toBe('staff');
  });
});

// ── execute() — customer_confirm ─────────────────────────────────────────────

describe('execute() — customer_confirm', () => {
  it('executes with correct confirmText', () => {
    const result = registry.execute('book_private_session', { confirmText: 'BOOK_PRIVATE' });
    expect(result.tool.tier).toBe('customer_confirm');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('book_private_session', {}))
      .toThrow('confirmText is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('book_private_session', { confirmText: 'BOOK' }))
      .toThrow('"BOOK_PRIVATE"');
  });
});

// ── execute() — staff_approval ────────────────────────────────────────────────

describe('execute() — staff_approval', () => {
  it('executes get_payroll_data with confirmApprovalId', () => {
    expect(registry.execute('get_payroll_data', { confirmApprovalId: 'APR-1' }).tool.tier)
      .toBe('staff_approval');
  });

  it('throws when confirmApprovalId missing for get_payroll_data', () => {
    expect(() => registry.execute('get_payroll_data', {})).toThrow('confirmApprovalId is required');
  });

  it('executes export_teacher_data with confirmApprovalId', () => {
    expect(registry.execute('export_teacher_data', { confirmApprovalId: 'A1' }).tool.name)
      .toBe('export_teacher_data');
  });
});

// ── execute() — admin ─────────────────────────────────────────────────────────

describe('execute() — admin tier', () => {
  it('executes set_commission_rate', () => {
    expect(registry.execute('set_commission_rate', { percent: 20 }).tool.tier).toBe('admin');
  });

  it('executes bulk_performance_report', () => {
    expect(registry.execute('bulk_performance_report', {}).tool.tier).toBe('admin');
  });
});

// ── execute() — admin_destructive ─────────────────────────────────────────────

describe('execute() — admin_destructive', () => {
  it('executes with both confirmText and confirmApprovalId', () => {
    const result = registry.execute('delete_teacher_profile', {
      confirmText:       'DELETE_TEACHER',
      confirmApprovalId: 'APR-99',
    });
    expect(result.tool.tier).toBe('admin_destructive');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('delete_teacher_profile', { confirmApprovalId: 'A1' }))
      .toThrow('confirmText is required');
  });

  it('throws when confirmApprovalId missing', () => {
    expect(() => registry.execute('delete_teacher_profile', { confirmText: 'DELETE_TEACHER' }))
      .toThrow('confirmApprovalId is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('delete_teacher_profile', { confirmText: 'DELETE', confirmApprovalId: 'A1' }))
      .toThrow('"DELETE_TEACHER"');
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
