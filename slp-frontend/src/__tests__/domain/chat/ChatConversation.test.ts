import { describe, it, expect } from '@jest/globals';
import { ChatConversation } from '../../../domain/chat/ChatConversation';

const NOW    = new Date('2026-08-05T10:00:00Z');
const LATER  = new Date('2026-08-05T11:00:00Z');
const FUTURE = new Date('2027-01-01T00:00:00Z');

function makeConvo(overrides: Partial<ConstructorParameters<typeof ChatConversation>[0]> = {}): ChatConversation {
  return new ChatConversation({
    id: 'conv-1',
    customerId: 'cust-1',
    channel: 'web',
    status: 'open',
    priority: 'normal',
    tags: [],
    messageCount: 0,
    lastActivityAt: NOW,
    openedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('ChatConversation — construction', () => {
  it('creates a valid open conversation', () => {
    const c = makeConvo();
    expect(c.id).toBe('conv-1');
    expect(c.status).toBe('open');
    expect(c.channel).toBe('web');
    expect(c.priority).toBe('normal');
  });

  it('throws when id is missing', () => {
    expect(() => makeConvo({ id: '' })).toThrow('id is required');
  });

  it('throws when customerId is missing', () => {
    expect(() => makeConvo({ customerId: '' })).toThrow('customerId is required');
  });

  it('throws when messageCount is negative', () => {
    expect(() => makeConvo({ messageCount: -1 })).toThrow('messageCount cannot be negative');
  });

  it('throws when satisfactionScore is out of range', () => {
    expect(() => makeConvo({ satisfactionScore: 6 })).toThrow('satisfactionScore must be 1-5');
    expect(() => makeConvo({ satisfactionScore: 0 })).toThrow('satisfactionScore must be 1-5');
  });

  it('throws when resolved status has no resolvedAt', () => {
    expect(() => makeConvo({ status: 'resolved', resolvedAt: undefined })).toThrow('resolvedAt is required');
  });

  it('throws when snoozed status has no snoozeUntil', () => {
    expect(() => makeConvo({ status: 'snoozed', snoozeUntil: undefined })).toThrow('snoozeUntil is required');
  });

  it('throws when snoozeUntil is not after openedAt', () => {
    expect(() => makeConvo({ snoozeUntil: NOW })).toThrow('snoozeUntil must be after openedAt');
  });

  it('accepts valid resolved conversation', () => {
    const c = makeConvo({ status: 'resolved', resolvedAt: LATER });
    expect(c.resolvedAt).toEqual(LATER);
  });
});

// ── Predicates ────────────────────────────────────────────────────────────────

describe('status predicates', () => {
  it('isOpen', () => expect(makeConvo({ status: 'open' }).isOpen()).toBe(true));
  it('isPending', () => expect(makeConvo({ status: 'pending' }).isPending()).toBe(true));
  it('isResolved', () => expect(makeConvo({ status: 'resolved', resolvedAt: LATER }).isResolved()).toBe(true));
  it('isSnoozed', () => expect(makeConvo({ status: 'snoozed', snoozeUntil: LATER }).isSnoozed()).toBe(true));
  it('isAssigned true when agentId set', () => expect(makeConvo({ assignedAgentId: 'ag-1' }).isAssigned()).toBe(true));
  it('isAssigned false when no agent', () => expect(makeConvo().isAssigned()).toBe(false));
  it('hasBotAssigned', () => expect(makeConvo({ assignedBotId: 'bot-1' }).hasBotAssigned()).toBe(true));
});

// ── assign() ──────────────────────────────────────────────────────────────────

describe('assign()', () => {
  it('assigns an agent and sets status to open', () => {
    const c = makeConvo({ status: 'pending' }).assign('ag-1', LATER);
    expect(c.assignedAgentId).toBe('ag-1');
    expect(c.status).toBe('open');
    expect(c.lastActivityAt).toEqual(LATER);
  });

  it('throws when agentId is empty', () => {
    expect(() => makeConvo().assign('', LATER)).toThrow('agentId is required');
  });

  it('throws when assigning to a resolved conversation', () => {
    const c = makeConvo({ status: 'resolved', resolvedAt: LATER });
    expect(() => c.assign('ag-1', LATER)).toThrow('cannot assign a resolved conversation');
  });

  it('throws when agent is already assigned', () => {
    const c = makeConvo({ assignedAgentId: 'ag-1' });
    expect(() => c.assign('ag-1', LATER)).toThrow('agent is already assigned');
  });

  it('does not mutate original', () => {
    const c = makeConvo();
    c.assign('ag-1', LATER);
    expect(c.assignedAgentId).toBeUndefined();
  });
});

// ── unassign() ────────────────────────────────────────────────────────────────

describe('unassign()', () => {
  it('removes agent and sets status to pending', () => {
    const c = makeConvo({ assignedAgentId: 'ag-1' }).unassign(LATER);
    expect(c.assignedAgentId).toBeUndefined();
    expect(c.status).toBe('pending');
  });

  it('throws when no agent is assigned', () => {
    expect(() => makeConvo().unassign(LATER)).toThrow('no agent assigned');
  });
});

// ── resolve() ─────────────────────────────────────────────────────────────────

describe('resolve()', () => {
  it('sets status to resolved with resolvedAt', () => {
    const c = makeConvo().resolve(LATER);
    expect(c.status).toBe('resolved');
    expect(c.resolvedAt).toEqual(LATER);
  });

  it('throws when already resolved', () => {
    const c = makeConvo({ status: 'resolved', resolvedAt: LATER });
    expect(() => c.resolve(FUTURE)).toThrow('already resolved');
  });
});

// ── reopen() ──────────────────────────────────────────────────────────────────

describe('reopen()', () => {
  it('reopens a resolved conversation', () => {
    const c = makeConvo({ status: 'resolved', resolvedAt: LATER }).reopen(FUTURE);
    expect(c.status).toBe('open');
    expect(c.resolvedAt).toBeUndefined();
  });

  it('reopens a snoozed conversation', () => {
    const c = makeConvo({ status: 'snoozed', snoozeUntil: LATER }).reopen(FUTURE);
    expect(c.status).toBe('open');
    expect(c.snoozeUntil).toBeUndefined();
  });

  it('throws when already open', () => {
    expect(() => makeConvo({ status: 'open' }).reopen(LATER)).toThrow('already open');
  });

  it('throws when pending', () => {
    expect(() => makeConvo({ status: 'pending' }).reopen(LATER)).toThrow('already pending');
  });
});

// ── snooze() ──────────────────────────────────────────────────────────────────

describe('snooze()', () => {
  it('snoozes an open conversation', () => {
    const c = makeConvo().snooze(LATER, NOW);
    expect(c.status).toBe('snoozed');
    expect(c.snoozeUntil).toEqual(LATER);
  });

  it('throws when resolved', () => {
    const c = makeConvo({ status: 'resolved', resolvedAt: LATER });
    expect(() => c.snooze(FUTURE, LATER)).toThrow('cannot snooze a resolved conversation');
  });

  it('throws when already snoozed', () => {
    const c = makeConvo({ status: 'snoozed', snoozeUntil: LATER });
    expect(() => c.snooze(FUTURE, LATER)).toThrow('already snoozed');
  });

  it('throws when snoozeUntil is not in the future', () => {
    expect(() => makeConvo().snooze(NOW, LATER)).toThrow('must be in the future');
  });
});

// ── escalate() ────────────────────────────────────────────────────────────────

describe('escalate()', () => {
  it('sets priority to urgent', () => {
    expect(makeConvo({ priority: 'low' }).escalate(LATER).priority).toBe('urgent');
    expect(makeConvo({ priority: 'high' }).escalate(LATER).priority).toBe('urgent');
  });

  it('throws when already urgent', () => {
    expect(() => makeConvo({ priority: 'urgent' }).escalate(LATER)).toThrow('already urgent');
  });
});

// ── tags ──────────────────────────────────────────────────────────────────────

describe('addTag() / removeTag()', () => {
  it('adds a tag', () => {
    const c = makeConvo().addTag('billing', LATER);
    expect(c.tags).toContain('billing');
  });

  it('throws on duplicate tag', () => {
    expect(() => makeConvo({ tags: ['billing'] }).addTag('billing', LATER)).toThrow('already exists');
  });

  it('throws on empty tag', () => {
    expect(() => makeConvo().addTag('', LATER)).toThrow('tag is required');
  });

  it('removes a tag', () => {
    const c = makeConvo({ tags: ['billing', 'urgent'] }).removeTag('billing', LATER);
    expect(c.tags).not.toContain('billing');
    expect(c.tags).toContain('urgent');
  });

  it('throws when removing a non-existent tag', () => {
    expect(() => makeConvo().removeTag('ghost', LATER)).toThrow('not found');
  });

  it('tags array is defensive copy', () => {
    const c = makeConvo({ tags: ['a'] });
    const tags = c.tags;
    tags.push('b');
    expect(c.tags).toEqual(['a']);
  });
});

// ── setSatisfaction() ─────────────────────────────────────────────────────────

describe('setSatisfaction()', () => {
  it('sets score and feedback on a resolved conversation', () => {
    const resolved = makeConvo({ status: 'resolved', resolvedAt: LATER });
    const c = resolved.setSatisfaction(5, 'Great support!', FUTURE);
    expect(c.satisfactionScore).toBe(5);
    expect(c.satisfactionFeedback).toBe('Great support!');
  });

  it('throws when conversation is not resolved', () => {
    expect(() => makeConvo().setSatisfaction(4, undefined, LATER)).toThrow('resolved');
  });

  it('throws when score is out of range', () => {
    const resolved = makeConvo({ status: 'resolved', resolvedAt: LATER });
    expect(() => resolved.setSatisfaction(6, undefined, FUTURE)).toThrow('1-5');
  });
});

// ── incrementMessageCount() ───────────────────────────────────────────────────

describe('incrementMessageCount()', () => {
  it('increments by 1', () => {
    const c = makeConvo({ messageCount: 3 }).incrementMessageCount(LATER);
    expect(c.messageCount).toBe(4);
    expect(c.lastActivityAt).toEqual(LATER);
  });
});
