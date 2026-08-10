import { describe, it, expect } from '@jest/globals';
import { ClassSequence, type ClassSequenceProps, type SequenceItem } from '../../../domain/yoga/ClassSequence';

const NOW    = new Date('2026-08-05T10:00:00Z');
const LATER  = new Date('2026-08-05T11:00:00Z');
const FUTURE = new Date('2027-01-01T00:00:00Z');

function make(overrides?: Partial<ClassSequenceProps>): ClassSequence {
  return new ClassSequence({
    id:              'seq-1',
    tenantId:        'tenant-1',
    teacherId:       'teacher-1',
    title:           'Morning Flow',
    style:           'vinyasa',
    difficultyLevel: 'beginner',
    goals:           ['flexibility'],
    items:           [],
    isTemplate:      false,
    status:          'draft',
    createdAt:       NOW,
    updatedAt:       NOW,
    ...overrides,
  });
}

const item1: SequenceItem = { order: 1, asanaId: 'tadasana',  durationSeconds: 60 };
const item2: SequenceItem = { order: 2, asanaId: 'adho-mukha', durationSeconds: 90 };
const item3: SequenceItem = { order: 3, asanaId: 'warrior-i', durationSeconds: 45 };

// ── Constructor ───────────────────────────────────────────────────────────────

describe('ClassSequence — constructor', () => {
  it('creates a draft sequence', () => {
    const s = make();
    expect(s.status).toBe('draft');
    expect(s.items).toHaveLength(0);
    expect(s.isDraft()).toBe(true);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when tenantId is empty', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws when teacherId is empty', () => {
    expect(() => make({ teacherId: '' })).toThrow('teacherId is required');
  });

  it('throws when title is empty', () => {
    expect(() => make({ title: '' })).toThrow('title is required');
  });

  it('throws when item durationSeconds < 10', () => {
    expect(() => make({ items: [{ order: 1, asanaId: 'tadasana', durationSeconds: 9 }] }))
      .toThrow('durationSeconds must be at least 10');
  });

  it('throws when item order is 0', () => {
    expect(() => make({ items: [{ order: 0, asanaId: 'tadasana', durationSeconds: 30 }] }))
      .toThrow('order must be a positive integer');
  });

  it('throws when item asanaId is empty', () => {
    expect(() => make({ items: [{ order: 1, asanaId: '', durationSeconds: 30 }] }))
      .toThrow('asanaId is required');
  });

  it('throws on duplicate item orders', () => {
    expect(() => make({ items: [
      { order: 1, asanaId: 'tadasana', durationSeconds: 30 },
      { order: 1, asanaId: 'warrior-i', durationSeconds: 30 },
    ]})).toThrow('unique order values');
  });

  it('accepts items with valid orders', () => {
    expect(() => make({ items: [item1, item2, item3] })).not.toThrow();
  });
});

// ── addItem() ─────────────────────────────────────────────────────────────────

describe('addItem()', () => {
  it('adds an item', () => {
    const s = make().addItem(item1, LATER);
    expect(s.items).toHaveLength(1);
    expect(s.items[0].asanaId).toBe('tadasana');
    expect(s.updatedAt).toEqual(LATER);
  });

  it('throws on duplicate order', () => {
    const s = make().addItem(item1, NOW);
    expect(() => s.addItem({ ...item1, asanaId: 'other' }, LATER))
      .toThrow('item with order 1 already exists');
  });

  it('throws when durationSeconds < 10', () => {
    expect(() => make().addItem({ order: 1, asanaId: 'tadasana', durationSeconds: 5 }, NOW))
      .toThrow('durationSeconds must be at least 10');
  });

  it('allows different orders', () => {
    const s = make().addItem(item1, NOW).addItem(item2, LATER);
    expect(s.items).toHaveLength(2);
  });
});

// ── removeItem() ──────────────────────────────────────────────────────────────

describe('removeItem()', () => {
  it('removes item by order', () => {
    const s = make().addItem(item1, NOW).addItem(item2, NOW).removeItem(1, LATER);
    expect(s.items).toHaveLength(1);
    expect(s.items[0].order).toBe(2);
  });

  it('throws when order not found', () => {
    expect(() => make().removeItem(99, NOW)).toThrow('item with order 99 not found');
  });
});

// ── reorderItems() ────────────────────────────────────────────────────────────

describe('reorderItems()', () => {
  it('swaps two items', () => {
    const s = make({ items: [item1, item2] }).reorderItems(1, 2, LATER);
    const sorted = s.items.sort((a, b) => a.order - b.order);
    expect(sorted[0].asanaId).toBe('adho-mukha'); // was order 2, now order 1
    expect(sorted[1].asanaId).toBe('tadasana');   // was order 1, now order 2
  });

  it('no-op when fromOrder === toOrder', () => {
    const s = make({ items: [item1, item2] });
    const result = s.reorderItems(1, 1, LATER);
    expect(result.items[0].asanaId).toBe(item1.asanaId);
  });

  it('throws when fromOrder not found', () => {
    expect(() => make({ items: [item1] }).reorderItems(99, 1, NOW))
      .toThrow('item with order 99 not found');
  });

  it('throws when toOrder not found', () => {
    expect(() => make({ items: [item1] }).reorderItems(1, 99, NOW))
      .toThrow('item with order 99 not found');
  });
});

// ── moveItemUp() / moveItemDown() ─────────────────────────────────────────────

describe('moveItemUp() / moveItemDown()', () => {
  const s3 = () => make({ items: [item1, item2, item3] });

  it('moves item up by swapping with previous', () => {
    const result = s3().moveItemUp(2, NOW);
    const at1 = result.items.find(i => i.order === 1)!;
    expect(at1.asanaId).toBe('adho-mukha'); // item2 moved to order 1
  });

  it('throws when already first', () => {
    expect(() => s3().moveItemUp(1, NOW)).toThrow('already first');
  });

  it('throws when order not found in moveItemUp', () => {
    expect(() => s3().moveItemUp(99, NOW)).toThrow('not found');
  });

  it('moves item down by swapping with next', () => {
    const result = s3().moveItemDown(2, NOW);
    const at3 = result.items.find(i => i.order === 3)!;
    expect(at3.asanaId).toBe('adho-mukha'); // item2 moved to order 3
  });

  it('throws when already last', () => {
    expect(() => s3().moveItemDown(3, NOW)).toThrow('already last');
  });
});

// ── goals ─────────────────────────────────────────────────────────────────────

describe('addGoal() / removeGoal()', () => {
  it('adds a goal', () => {
    const s = make().addGoal('strength', LATER);
    expect(s.goals).toContain('strength');
  });

  it('throws on duplicate goal', () => {
    expect(() => make({ goals: ['flexibility'] }).addGoal('flexibility', NOW))
      .toThrow('already added');
  });

  it('removes a goal', () => {
    const s = make({ goals: ['flexibility'] }).removeGoal('flexibility', LATER);
    expect(s.goals).toHaveLength(0);
  });

  it('throws when removing non-existent goal', () => {
    expect(() => make().removeGoal('strength', NOW)).toThrow('not found');
  });
});

// ── totalDurationSeconds ──────────────────────────────────────────────────────

describe('totalDurationSeconds()', () => {
  it('returns 0 for empty sequence', () => {
    expect(make().totalDurationSeconds()).toBe(0);
  });

  it('sums item durations', () => {
    const s = make({ items: [item1, item2, item3] });
    expect(s.totalDurationSeconds()).toBe(60 + 90 + 45); // 195
  });
});

// ── publish / archive / makeTemplate ──────────────────────────────────────────

describe('lifecycle state machine', () => {
  it('draft → published', () => {
    const s = make().publish(LATER);
    expect(s.status).toBe('published');
    expect(s.isPublished()).toBe(true);
  });

  it('throws when publishing non-draft', () => {
    expect(() => make().publish(NOW).publish(LATER)).toThrow('can only publish a draft');
  });

  it('published → archived', () => {
    const s = make().publish(NOW).archive(LATER);
    expect(s.status).toBe('archived');
    expect(s.isArchived()).toBe(true);
  });

  it('throws when archiving non-published', () => {
    expect(() => make().archive(NOW)).toThrow('can only archive a published');
  });

  it('makeTemplate requires published status', () => {
    const s = make().publish(NOW).makeTemplate(LATER);
    expect(s.isTemplate).toBe(true);
  });

  it('throws makeTemplate on draft', () => {
    expect(() => make().makeTemplate(NOW)).toThrow('published');
  });
});

// ── clone ─────────────────────────────────────────────────────────────────────

describe('clone(newId, newTeacherId, now)', () => {
  it('clones as new draft', () => {
    const original = make({ items: [item1, item2] }).publish(NOW);
    const copy = original.clone('seq-copy', 'teacher-2', LATER);
    expect(copy.id).toBe('seq-copy');
    expect(copy.teacherId).toBe('teacher-2');
    expect(copy.status).toBe('draft');
    expect(copy.isTemplate).toBe(false);
    expect(copy.items).toHaveLength(2);
  });

  it('throws when newId is empty', () => {
    expect(() => make().clone('', 'teacher-2', NOW)).toThrow('newId is required');
  });

  it('throws when newTeacherId is empty', () => {
    expect(() => make().clone('seq-copy', '', NOW)).toThrow('newTeacherId is required');
  });
});

// ── Defensive copies ──────────────────────────────────────────────────────────

describe('defensive copies', () => {
  it('items getter returns copy', () => {
    const s = make({ items: [item1] });
    s.items.push({ ...item2 });
    expect(s.items).toHaveLength(1);
  });

  it('goals getter returns copy', () => {
    const s = make({ goals: ['flexibility'] });
    s.goals.push('strength');
    expect(s.goals).toHaveLength(1);
  });
});
