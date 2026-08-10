import { describe, it, expect } from '@jest/globals';
import { ChatAgent } from '../../../domain/chat/ChatAgent';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function makeAgent(overrides: Partial<ConstructorParameters<typeof ChatAgent>[0]> = {}): ChatAgent {
  return new ChatAgent({
    id: 'ag-1',
    userId: 'user-1',
    displayName: 'Priya Sharma',
    role: 'agent',
    status: 'online',
    maxConcurrentChats: 3,
    skillTags: [],
    assignedConversationIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('ChatAgent — construction', () => {
  it('creates a valid agent', () => {
    const a = makeAgent();
    expect(a.id).toBe('ag-1');
    expect(a.displayName).toBe('Priya Sharma');
    expect(a.isOnline()).toBe(true);
    expect(a.isAvailable()).toBe(true);
  });

  it('throws when id is missing', () => {
    expect(() => makeAgent({ id: '' })).toThrow('id is required');
  });

  it('throws when userId is missing', () => {
    expect(() => makeAgent({ userId: '' })).toThrow('userId is required');
  });

  it('throws when displayName is missing', () => {
    expect(() => makeAgent({ displayName: '' })).toThrow('displayName is required');
  });

  it('throws when maxConcurrentChats < 1', () => {
    expect(() => makeAgent({ maxConcurrentChats: 0 })).toThrow('at least 1');
  });

  it('throws when satisfactionScore out of range', () => {
    expect(() => makeAgent({ satisfactionScore: 101 })).toThrow('0-100');
    expect(() => makeAgent({ satisfactionScore: -1 })).toThrow('0-100');
  });

  it('accepts satisfactionScore at boundary values', () => {
    expect(() => makeAgent({ satisfactionScore: 0 })).not.toThrow();
    expect(() => makeAgent({ satisfactionScore: 100 })).not.toThrow();
  });
});

// ── isAvailable / isAtCapacity ────────────────────────────────────────────────

describe('capacity predicates', () => {
  it('isAvailable when online and below max', () => {
    const a = makeAgent({ maxConcurrentChats: 2, assignedConversationIds: ['c1'] });
    expect(a.isAvailable()).toBe(true);
  });

  it('isAtCapacity when at max', () => {
    const a = makeAgent({ maxConcurrentChats: 2, assignedConversationIds: ['c1', 'c2'] });
    expect(a.isAtCapacity()).toBe(true);
    expect(a.isAvailable()).toBe(false);
  });

  it('not available when offline even if under capacity', () => {
    expect(makeAgent({ status: 'offline' }).isAvailable()).toBe(false);
  });

  it('currentLoad returns assigned count', () => {
    expect(makeAgent({ assignedConversationIds: ['c1', 'c2'] }).currentLoad()).toBe(2);
  });
});

// ── Status transitions ────────────────────────────────────────────────────────

describe('goOnline()', () => {
  it('transitions from offline to online', () => {
    expect(makeAgent({ status: 'offline' }).goOnline(LATER).status).toBe('online');
  });

  it('throws when already online', () => {
    expect(() => makeAgent({ status: 'online' }).goOnline(LATER)).toThrow('already online');
  });
});

describe('goOffline()', () => {
  it('transitions from online to offline', () => {
    expect(makeAgent({ status: 'online' }).goOffline(LATER).status).toBe('offline');
  });

  it('throws when already offline', () => {
    expect(() => makeAgent({ status: 'offline' }).goOffline(LATER)).toThrow('already offline');
  });
});

describe('setBusy()', () => {
  it('transitions from online to busy', () => {
    expect(makeAgent({ status: 'online' }).setBusy(LATER).status).toBe('busy');
  });

  it('transitions from away to busy', () => {
    expect(makeAgent({ status: 'away' }).setBusy(LATER).status).toBe('busy');
  });

  it('throws when offline', () => {
    expect(() => makeAgent({ status: 'offline' }).setBusy(LATER)).toThrow('offline agents cannot set busy');
  });

  it('throws when already busy', () => {
    expect(() => makeAgent({ status: 'busy' }).setBusy(LATER)).toThrow('already busy');
  });
});

describe('setAway()', () => {
  it('transitions to away', () => {
    expect(makeAgent({ status: 'online' }).setAway(LATER).status).toBe('away');
  });

  it('throws when offline', () => {
    expect(() => makeAgent({ status: 'offline' }).setAway(LATER)).toThrow('offline agents cannot set away');
  });

  it('throws when already away', () => {
    expect(() => makeAgent({ status: 'away' }).setAway(LATER)).toThrow('already away');
  });
});

// ── assignConversation() ──────────────────────────────────────────────────────

describe('assignConversation()', () => {
  it('assigns a conversation', () => {
    const a = makeAgent().assignConversation('conv-1', LATER);
    expect(a.assignedConversationIds).toContain('conv-1');
    expect(a.currentLoad()).toBe(1);
  });

  it('throws when offline', () => {
    expect(() => makeAgent({ status: 'offline' }).assignConversation('conv-1', LATER))
      .toThrow('offline agents');
  });

  it('throws when at capacity', () => {
    const full = makeAgent({ maxConcurrentChats: 1, assignedConversationIds: ['c1'] });
    expect(() => full.assignConversation('c2', LATER)).toThrow('maximum concurrent chat capacity');
  });

  it('throws when already assigned', () => {
    const a = makeAgent({ assignedConversationIds: ['conv-1'] });
    expect(() => a.assignConversation('conv-1', LATER)).toThrow('already assigned');
  });

  it('throws when conversationId is empty', () => {
    expect(() => makeAgent().assignConversation('', LATER)).toThrow('conversationId is required');
  });

  it('does not mutate original', () => {
    const a = makeAgent();
    a.assignConversation('conv-1', LATER);
    expect(a.assignedConversationIds).toHaveLength(0);
  });
});

// ── unassignConversation() ────────────────────────────────────────────────────

describe('unassignConversation()', () => {
  it('removes the conversation from assigned list', () => {
    const a = makeAgent({ assignedConversationIds: ['conv-1', 'conv-2'] }).unassignConversation('conv-1', LATER);
    expect(a.assignedConversationIds).not.toContain('conv-1');
    expect(a.assignedConversationIds).toContain('conv-2');
  });

  it('throws when not assigned', () => {
    expect(() => makeAgent().unassignConversation('conv-1', LATER)).toThrow('not assigned');
  });
});

// ── skills ────────────────────────────────────────────────────────────────────

describe('addSkill() / removeSkill()', () => {
  it('adds a skill', () => {
    const a = makeAgent().addSkill('yoga-beginner', LATER);
    expect(a.skillTags).toContain('yoga-beginner');
  });

  it('throws on duplicate skill', () => {
    expect(() => makeAgent({ skillTags: ['billing'] }).addSkill('billing', LATER)).toThrow('already exists');
  });

  it('throws when skill is empty', () => {
    expect(() => makeAgent().addSkill('', LATER)).toThrow('skill is required');
  });

  it('removes a skill', () => {
    const a = makeAgent({ skillTags: ['billing', 'yoga'] }).removeSkill('billing', LATER);
    expect(a.skillTags).not.toContain('billing');
    expect(a.skillTags).toContain('yoga');
  });

  it('throws when skill not found', () => {
    expect(() => makeAgent().removeSkill('ghost', LATER)).toThrow('not found');
  });

  it('skillTags is defensive copy', () => {
    const a = makeAgent({ skillTags: ['billing'] });
    a.skillTags.push('spy');
    expect(a.skillTags).toEqual(['billing']);
  });
});
