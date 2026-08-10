import { describe, it, expect } from '@jest/globals';
import { MeditationSession, type MeditationSessionProps, type MeditationStyle } from '../../../domain/yoga/MeditationSession';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function make(overrides?: Partial<MeditationSessionProps>): MeditationSession {
  return new MeditationSession({
    id:              'med-1',
    tenantId:        'tenant-1',
    title:           'Morning Stillness',
    style:           'mindfulness',
    durationMinutes: 10,
    description:     'A gentle morning practice',
    language:        'en',
    tags:            [],
    sessionGoals:    [],
    doshaBalance:    [],
    difficultyLevel: 'beginner',
    status:          'draft',
    playCount:       0,
    createdAt:       NOW,
    updatedAt:       NOW,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('MeditationSession — constructor', () => {
  it('creates a draft session', () => {
    const m = make();
    expect(m.status).toBe('draft');
    expect(m.playCount).toBe(0);
    expect(m.isDraft()).toBe(true);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when tenantId is empty', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws when title is empty', () => {
    expect(() => make({ title: '' })).toThrow('title is required');
  });

  it('throws when durationMinutes < 1', () => {
    expect(() => make({ durationMinutes: 0 })).toThrow('durationMinutes must be at least 1');
  });

  it('throws when language is not 2 chars', () => {
    expect(() => make({ language: 'eng' })).toThrow('ISO 639-1');
  });

  it('throws when language has uppercase', () => {
    expect(() => make({ language: 'EN' })).toThrow('ISO 639-1');
  });

  it('throws when playCount < 0', () => {
    expect(() => make({ playCount: -1 })).toThrow('playCount must be >= 0');
  });

  it('accepts all valid fields', () => {
    const m = make({ audioUrl: 'https://cdn.example.com/med.mp3', instructor: 'Meera' });
    expect(m.audioUrl).toBe('https://cdn.example.com/med.mp3');
    expect(m.instructor).toBe('Meera');
  });
});

// ── All meditation styles ─────────────────────────────────────────────────────

describe('meditation styles', () => {
  const styles: MeditationStyle[] = [
    'mindfulness','guided_visualization','yoga_nidra','mantra','breathing',
    'body_scan','loving_kindness','chakra','movement',
  ];
  it.each(styles)('accepts style: %s', (style) => {
    expect(() => make({ style })).not.toThrow();
  });
});

// ── addTag / removeTag ────────────────────────────────────────────────────────

describe('addTag() / removeTag()', () => {
  it('adds a tag', () => {
    const m = make().addTag('morning', LATER);
    expect(m.tags).toContain('morning');
    expect(m.updatedAt).toEqual(LATER);
  });

  it('throws on duplicate tag', () => {
    const m = make().addTag('morning', NOW);
    expect(() => m.addTag('morning', LATER)).toThrow('already added');
  });

  it('throws when tag is empty', () => {
    expect(() => make().addTag('', NOW)).toThrow('tag is required');
  });

  it('removes a tag', () => {
    const m = make().addTag('morning', NOW).removeTag('morning', LATER);
    expect(m.tags).toHaveLength(0);
  });

  it('throws when removing non-existent tag', () => {
    expect(() => make().removeTag('nonexistent', NOW)).toThrow('not found');
  });
});

// ── addGoal / removeGoal ──────────────────────────────────────────────────────

describe('addGoal() / removeGoal()', () => {
  it('adds a goal', () => {
    const m = make().addGoal('stress_relief', LATER);
    expect(m.sessionGoals).toContain('stress_relief');
  });

  it('throws on duplicate goal', () => {
    const m = make({ sessionGoals: ['sleep'] });
    expect(() => m.addGoal('sleep', NOW)).toThrow('already added');
  });

  it('removes a goal', () => {
    const m = make({ sessionGoals: ['sleep'] }).removeGoal('sleep', LATER);
    expect(m.sessionGoals).toHaveLength(0);
  });

  it('throws when removing non-existent goal', () => {
    expect(() => make().removeGoal('strength', NOW)).toThrow('not found');
  });
});

// ── setAudioUrl / setVideoUrl ─────────────────────────────────────────────────

describe('setAudioUrl() / setVideoUrl()', () => {
  it('sets audio url', () => {
    const m = make().setAudioUrl('https://cdn.example.com/audio.mp3', LATER);
    expect(m.audioUrl).toBe('https://cdn.example.com/audio.mp3');
    expect(m.updatedAt).toEqual(LATER);
  });

  it('throws when audioUrl is empty', () => {
    expect(() => make().setAudioUrl('', NOW)).toThrow('audioUrl is required');
  });

  it('sets video url', () => {
    const m = make().setVideoUrl('https://cdn.example.com/video.mp4', LATER);
    expect(m.videoUrl).toBe('https://cdn.example.com/video.mp4');
  });

  it('throws when videoUrl is empty', () => {
    expect(() => make().setVideoUrl('', NOW)).toThrow('videoUrl is required');
  });
});

// ── incrementPlayCount ────────────────────────────────────────────────────────

describe('incrementPlayCount()', () => {
  it('increments play count', () => {
    const m = make({ playCount: 5 }).incrementPlayCount();
    expect(m.playCount).toBe(6);
  });

  it('is immutable — original unchanged', () => {
    const original = make({ playCount: 3 });
    original.incrementPlayCount();
    expect(original.playCount).toBe(3);
  });

  it('chains multiple increments', () => {
    const m = make().incrementPlayCount().incrementPlayCount().incrementPlayCount();
    expect(m.playCount).toBe(3);
  });
});

// ── publish / archive ─────────────────────────────────────────────────────────

describe('lifecycle state machine', () => {
  it('draft → published', () => {
    const m = make().publish(LATER);
    expect(m.status).toBe('published');
    expect(m.isPublished()).toBe(true);
    expect(m.updatedAt).toEqual(LATER);
  });

  it('throws when publishing non-draft', () => {
    expect(() => make().publish(NOW).publish(LATER)).toThrow('can only publish a draft');
  });

  it('published → archived', () => {
    const m = make().publish(NOW).archive(LATER);
    expect(m.status).toBe('archived');
    expect(m.isArchived()).toBe(true);
  });

  it('throws when archiving non-published', () => {
    expect(() => make().archive(NOW)).toThrow('can only archive a published');
  });
});

// ── Defensive copies ──────────────────────────────────────────────────────────

describe('defensive copies', () => {
  it('tags getter returns copy', () => {
    const m = make().addTag('morning', NOW);
    m.tags.push('mutated');
    expect(m.tags).toHaveLength(1);
  });

  it('sessionGoals getter returns copy', () => {
    const m = make({ sessionGoals: ['sleep'] });
    m.sessionGoals.push('mutated' as any);
    expect(m.sessionGoals).toHaveLength(1);
  });
});
