import { describe, it, expect } from '@jest/globals';
import { McpToolCall, type McpToolCallProps, type McpTier } from '../../../domain/mcp/McpToolCall';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function make(overrides?: Partial<McpToolCallProps>): McpToolCall {
  return new McpToolCall({
    id:                      'call-1',
    tenantId:                'tenant-1',
    serverId:                'srv-1',
    toolName:                'create_branch',
    tier:                    'staff',
    status:                  'pending_approval',
    actorId:                 'user-1',
    actorRole:               'admin',
    flaggedForReview:        false,
    promptInjectionSuspected: false,
    createdAt:               NOW,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('McpToolCall — constructor', () => {
  it('creates a pending call', () => {
    const c = make();
    expect(c.status).toBe('pending_approval');
    expect(c.isPendingApproval()).toBe(true);
    expect(c.flaggedForReview).toBe(false);
  });

  it('throws when id is empty',       () => expect(() => make({ id: '' })).toThrow('id is required'));
  it('throws when tenantId is empty', () => expect(() => make({ tenantId: '' })).toThrow('tenantId is required'));
  it('throws when serverId is empty', () => expect(() => make({ serverId: '' })).toThrow('serverId is required'));
  it('throws when toolName is empty', () => expect(() => make({ toolName: '' })).toThrow('toolName is required'));
  it('throws when actorId is empty',  () => expect(() => make({ actorId: '' })).toThrow('actorId is required'));
  it('throws when actorRole is empty',() => expect(() => make({ actorRole: '' })).toThrow('actorRole is required'));

  it('throws when durationMs is negative', () => {
    expect(() => make({ durationMs: -1 })).toThrow('non-negative');
  });

  it('throws when approved but no approvalId', () => {
    expect(() => make({ status: 'approved' })).toThrow('requires approvalId');
  });

  it('throws when rejected but no rejectionReason', () => {
    expect(() => make({ status: 'rejected' })).toThrow('requires rejectionReason');
  });

  it('accepts approved with approvalId', () => {
    expect(() => make({ status: 'approved', approvalId: 'APR-1' })).not.toThrow();
  });
});

// ── All tiers ─────────────────────────────────────────────────────────────────

describe('all tiers accepted', () => {
  const tiers: McpTier[] = ['auto', 'staff', 'customer_confirm', 'staff_approval', 'admin', 'admin_destructive'];
  it.each(tiers)('accepts tier: %s', tier => {
    expect(() => make({ tier })).not.toThrow();
  });
});

// ── requiresApproval() ────────────────────────────────────────────────────────

describe('requiresApproval()', () => {
  it('returns true for staff_approval', () => {
    expect(make({ tier: 'staff_approval' }).requiresApproval()).toBe(true);
  });

  it('returns true for admin_destructive', () => {
    expect(make({ tier: 'admin_destructive' }).requiresApproval()).toBe(true);
  });

  it('returns false for auto', () => {
    expect(make({ tier: 'auto', status: 'success' }).requiresApproval()).toBe(false);
  });

  it('returns false for staff', () => {
    expect(make({ tier: 'staff' }).requiresApproval()).toBe(false);
  });
});

// ── markSuccess() ─────────────────────────────────────────────────────────────

describe('markSuccess()', () => {
  it('pending_approval → success', () => {
    const c = make().markSuccess(120, LATER);
    expect(c.isSuccessful()).toBe(true);
    expect(c.durationMs).toBe(120);
    expect(c.resolvedAt).toEqual(LATER);
  });

  it('throws on terminal state', () => {
    const done = make({ status: 'success' });
    expect(() => done.markSuccess(100, LATER)).toThrow('terminal');
  });

  it('throws on negative durationMs', () => {
    expect(() => make().markSuccess(-1, LATER)).toThrow('non-negative');
  });
});

// ── markFailed() ──────────────────────────────────────────────────────────────

describe('markFailed()', () => {
  it('sets failed status with error and duration', () => {
    const c = make().markFailed('Connection refused', 50, LATER);
    expect(c.status).toBe('failed');
    expect(c.errorMessage).toBe('Connection refused');
    expect(c.durationMs).toBe(50);
    expect(c.resolvedAt).toEqual(LATER);
  });

  it('throws when errorMessage is empty', () => {
    expect(() => make().markFailed('', 50, LATER)).toThrow('errorMessage is required');
  });

  it('throws on terminal state', () => {
    const done = make({ status: 'failed', errorMessage: 'err' });
    expect(() => done.markFailed('again', 10, LATER)).toThrow('terminal');
  });
});

// ── markTimeout() ─────────────────────────────────────────────────────────────

describe('markTimeout()', () => {
  it('sets timeout status', () => {
    const c = make().markTimeout(30000, LATER);
    expect(c.status).toBe('timeout');
    expect(c.durationMs).toBe(30000);
  });

  it('throws on terminal state', () => {
    const done = make({ status: 'timeout' });
    expect(() => done.markTimeout(100, LATER)).toThrow('terminal');
  });
});

// ── approve() ─────────────────────────────────────────────────────────────────

describe('approve()', () => {
  it('pending_approval → approved', () => {
    const c = make().approve('APR-42', LATER);
    expect(c.isApproved()).toBe(true);
    expect(c.approvalId).toBe('APR-42');
    expect(c.resolvedAt).toEqual(LATER);
  });

  it('throws when not pending', () => {
    expect(() => make({ status: 'success' }).approve('APR-1', LATER)).toThrow('pending_approval');
  });

  it('throws when approvalId is empty', () => {
    expect(() => make().approve('', LATER)).toThrow('approvalId is required');
  });
});

// ── reject() ──────────────────────────────────────────────────────────────────

describe('reject()', () => {
  it('pending_approval → rejected', () => {
    const c = make().reject('Insufficient permissions', LATER);
    expect(c.status).toBe('rejected');
    expect(c.rejectionReason).toBe('Insufficient permissions');
    expect(c.isTerminal()).toBe(true);
  });

  it('throws when not pending', () => {
    expect(() => make({ status: 'approved', approvalId: 'A1' }).reject('r', LATER))
      .toThrow('pending_approval');
  });

  it('throws when reason is empty', () => {
    expect(() => make().reject('', LATER)).toThrow('rejectionReason is required');
  });
});

// ── flagForReview() / suspectPromptInjection() ───────────────────────────────

describe('flagForReview() / suspectPromptInjection()', () => {
  it('flags call for review', () => {
    const c = make().flagForReview();
    expect(c.flaggedForReview).toBe(true);
    expect(c.isSuspicious()).toBe(true);
  });

  it('throws when already flagged', () => {
    expect(() => make({ flaggedForReview: true }).flagForReview()).toThrow('already flagged');
  });

  it('suspectPromptInjection sets both flags', () => {
    const c = make().suspectPromptInjection();
    expect(c.promptInjectionSuspected).toBe(true);
    expect(c.flaggedForReview).toBe(true);
  });

  it('suspectPromptInjection idempotent on injection flag', () => {
    const c = make({ promptInjectionSuspected: true }).suspectPromptInjection();
    expect(c.promptInjectionSuspected).toBe(true);
  });
});

// ── isTerminal() ──────────────────────────────────────────────────────────────

describe('isTerminal()', () => {
  const terminals = ['success', 'failed', 'timeout', 'rejected'] as const;
  it.each(terminals)('is terminal: %s', status => {
    const extra = status === 'rejected'
      ? { rejectionReason: 'r' }
      : status === 'failed' ? { errorMessage: 'e' } : {};
    expect(make({ status, ...extra } as Partial<McpToolCallProps>).isTerminal()).toBe(true);
  });

  it('pending_approval is not terminal', () => {
    expect(make().isTerminal()).toBe(false);
  });

  it('approved is not terminal', () => {
    expect(make({ status: 'approved', approvalId: 'A1' }).isTerminal()).toBe(false);
  });
});

// ── Immutability ──────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('approve does not mutate original', () => {
    const original = make();
    original.approve('APR-1', LATER);
    expect(original.status).toBe('pending_approval');
  });
});
