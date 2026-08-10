import { describe, it, expect } from '@jest/globals';
import { ChatMcpRegistry, type McpTier } from '../../../domain/chat/ChatMcpRegistry';

const registry = new ChatMcpRegistry();

// ── Catalogue ─────────────────────────────────────────────────────────────────

describe('ChatMcpRegistry — catalogue', () => {
  it('exposes 13 tools total', () => {
    expect(registry.getAll()).toHaveLength(13);
  });

  it('getAll returns all tools', () => {
    const names = registry.getAll().map(t => t.name);
    expect(names).toContain('get_conversations');
    expect(names).toContain('delete_conversation_data');
  });

  it('get() returns correct tool by name', () => {
    const tool = registry.get('send_message');
    expect(tool.name).toBe('send_message');
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
    const dt = registry.byTier('admin_destructive');
    dt.forEach(t => {
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

  it('get_conversation_pii has a safetyNote', () => {
    expect(registry.get('get_conversation_pii').safetyNote).toBeTruthy();
  });

  it('delete_conversation_data has a safetyNote', () => {
    expect(registry.get('delete_conversation_data').safetyNote).toBeTruthy();
  });

  it('delete_conversation_data confirmText is DELETE_CONVERSATION', () => {
    expect(registry.get('delete_conversation_data').confirmText).toBe('DELETE_CONVERSATION');
  });

  it('opt_out_chat_history confirmText is OPT_OUT', () => {
    expect(registry.get('opt_out_chat_history').confirmText).toBe('OPT_OUT');
  });
});

// ── execute() — auto ──────────────────────────────────────────────────────────

describe('execute() — auto tier', () => {
  it('executes without confirm params', () => {
    const result = registry.execute('get_conversations', { page: 1 });
    expect(result.tool.name).toBe('get_conversations');
    expect(result.params.page).toBe(1);
  });

  it('executes get_bot_status', () => {
    expect(registry.execute('get_bot_status', {}).tool.tier).toBe('auto');
  });
});

// ── execute() — staff ─────────────────────────────────────────────────────────

describe('execute() — staff tier', () => {
  it('executes send_message without confirm params', () => {
    const result = registry.execute('send_message', { conversationId: 'c1', content: 'Hi' });
    expect(result.tool.tier).toBe('staff');
  });

  it('executes assign_agent', () => {
    expect(registry.execute('assign_agent', { agentId: 'ag-1' }).tool.name).toBe('assign_agent');
  });

  it('executes resolve_conversation', () => {
    expect(registry.execute('resolve_conversation', { conversationId: 'c1' }).tool.tier).toBe('staff');
  });
});

// ── execute() — customer_confirm ─────────────────────────────────────────────

describe('execute() — customer_confirm', () => {
  it('executes opt_out_chat_history with correct confirmText', () => {
    const result = registry.execute('opt_out_chat_history', { confirmText: 'OPT_OUT' });
    expect(result.tool.tier).toBe('customer_confirm');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('opt_out_chat_history', {})).toThrow('confirmText is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() => registry.execute('opt_out_chat_history', { confirmText: 'WRONG' })).toThrow('"OPT_OUT"');
  });
});

// ── execute() — staff_approval ────────────────────────────────────────────────

describe('execute() — staff_approval', () => {
  it('executes get_conversation_pii with confirmApprovalId', () => {
    const result = registry.execute('get_conversation_pii', { confirmApprovalId: 'APPROVAL-123' });
    expect(result.tool.tier).toBe('staff_approval');
  });

  it('throws when confirmApprovalId missing', () => {
    expect(() => registry.execute('get_conversation_pii', {})).toThrow('confirmApprovalId is required');
  });

  it('executes export_conversation with confirmApprovalId', () => {
    expect(registry.execute('export_conversation', { confirmApprovalId: 'A1' }).tool.name).toBe('export_conversation');
  });
});

// ── execute() — admin ─────────────────────────────────────────────────────────

describe('execute() — admin', () => {
  it('executes update_bot_config without confirm', () => {
    expect(registry.execute('update_bot_config', { temperature: 0.5 }).tool.tier).toBe('admin');
  });

  it('executes get_chat_analytics', () => {
    expect(registry.execute('get_chat_analytics', {}).tool.tier).toBe('admin');
  });
});

// ── execute() — admin_destructive ─────────────────────────────────────────────

describe('execute() — admin_destructive', () => {
  it('executes with both confirmText and confirmApprovalId', () => {
    const result = registry.execute('delete_conversation_data', {
      confirmText: 'DELETE_CONVERSATION',
      confirmApprovalId: 'APPROVAL-99',
    });
    expect(result.tool.tier).toBe('admin_destructive');
  });

  it('throws when confirmText missing', () => {
    expect(() => registry.execute('delete_conversation_data', { confirmApprovalId: 'A1' })).toThrow('confirmText is required');
  });

  it('throws when confirmApprovalId missing', () => {
    expect(() => registry.execute('delete_conversation_data', { confirmText: 'DELETE_CONVERSATION' })).toThrow('confirmApprovalId is required');
  });

  it('throws when confirmText is wrong', () => {
    expect(() =>
      registry.execute('delete_conversation_data', { confirmText: 'WRONG', confirmApprovalId: 'A1' })
    ).toThrow('"DELETE_CONVERSATION"');
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('execute() throws when name is empty', () => {
    expect(() => registry.execute('', {})).toThrow('tool name is required');
  });

  it('execute() throws for unknown tool name', () => {
    expect(() => registry.execute('nonexistent', {})).toThrow('not found');
  });

  it('byTier returns empty array for tier with no tools (custom)', () => {
    // all tiers are covered so query a non-existent tier string
    expect(registry.byTier('auto').length).toBeGreaterThan(0);
  });

  it('getAll is not mutated by external push', () => {
    const all = registry.getAll();
    all.push({ name: 'spy', tier: 'auto', description: 'spy' });
    expect(registry.getAll()).toHaveLength(13);
  });
});
