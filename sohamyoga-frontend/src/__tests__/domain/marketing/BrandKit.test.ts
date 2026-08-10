import { describe, it, expect } from '@jest/globals';
import { BrandKit, BrandKitProps, ToneWord } from '../../../domain/marketing/BrandKit';

const T0 = new Date('2026-03-01T00:00:00Z');
const T1 = new Date('2026-03-10T00:00:00Z');

function make(overrides: Partial<BrandKitProps> = {}): BrandKit {
  return new BrandKit({
    id:               'bk-1',
    tenantId:         'tenant-1',
    name:             'Soham Yoga Main Brand',
    primaryColor:     '#4F46E5',
    secondaryColor:   '#10B981',
    accentColor:      '#F59E0B',
    logoUrl:          'https://assets.sohamyoga.ca/logo.svg',
    fontPrimary:      'Inter',
    toneWords:        ['warm', 'mindful'],
    approvedPhrases:  ['Find your flow', 'Begin your journey'],
    bannedPhrases:    ['cheap', 'discount', 'cure'],
    defaultHashtags:  ['#SohamYoga', '#YogaLife'],
    isDefault:        true,
    updatedBy:        'admin-1',
    updatedAt:        T0,
    ...overrides,
  });
}

// ── Constructor validation ─────────────────────────────────────────────────────

describe('BrandKit — constructor validation', () => {
  it('constructs a valid brand kit', () => {
    const bk = make();
    expect(bk.id).toBe('bk-1');
    expect(bk.primaryColor).toBe('#4F46E5');
    expect(bk.toneWords).toEqual(['warm', 'mindful']);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when tenantId is empty', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws when name is blank', () => {
    expect(() => make({ name: '   ' })).toThrow('name is required');
  });

  it('throws for invalid primaryColor (missing hash)', () => {
    expect(() => make({ primaryColor: '4F46E5' }))
      .toThrow('primaryColor must be a valid hex color (#RRGGBB)');
  });

  it('throws for invalid primaryColor (shorthand)', () => {
    expect(() => make({ primaryColor: '#FFF' }))
      .toThrow('primaryColor must be a valid hex color (#RRGGBB)');
  });

  it('throws for invalid secondaryColor', () => {
    expect(() => make({ secondaryColor: 'rgb(0,0,0)' }))
      .toThrow('secondaryColor must be a valid hex color (#RRGGBB)');
  });

  it('throws for invalid accentColor', () => {
    expect(() => make({ accentColor: 'orange' }))
      .toThrow('accentColor must be a valid hex color (#RRGGBB)');
  });

  it('throws when fontPrimary is blank', () => {
    expect(() => make({ fontPrimary: '   ' })).toThrow('fontPrimary is required');
  });

  it('throws when toneWords is empty', () => {
    expect(() => make({ toneWords: [] as ToneWord[] })).toThrow('at least one tone word is required');
  });

  it('throws when toneWords has more than 5 entries', () => {
    const words: ToneWord[] = ['warm', 'mindful', 'calm', 'inspiring', 'premium', 'energetic'];
    expect(() => make({ toneWords: words })).toThrow('maximum 5 tone words per brand kit');
  });

  it('accepts exactly 5 tone words', () => {
    const words: ToneWord[] = ['warm', 'mindful', 'calm', 'inspiring', 'premium'];
    expect(() => make({ toneWords: words })).not.toThrow();
  });
});

// ── Getters ────────────────────────────────────────────────────────────────────

describe('BrandKit — getters return copies', () => {
  it('toneWords getter returns a copy', () => {
    const bk = make();
    bk.toneWords.push('calm' as ToneWord);
    expect(bk.toneWords).toHaveLength(2);
  });

  it('approvedPhrases getter returns a copy', () => {
    const bk = make();
    bk.approvedPhrases.push('Hack phrase');
    expect(bk.approvedPhrases).toHaveLength(2);
  });

  it('bannedPhrases getter returns a copy', () => {
    const bk = make();
    bk.bannedPhrases.push('hack');
    expect(bk.bannedPhrases).toHaveLength(3);
  });

  it('defaultHashtags getter returns a copy', () => {
    const bk = make();
    bk.defaultHashtags.push('#hack');
    expect(bk.defaultHashtags).toHaveLength(2);
  });
});

// ── containsBannedPhrase() ─────────────────────────────────────────────────────

describe('BrandKit — containsBannedPhrase()', () => {
  it('returns true when text contains a banned phrase', () => {
    expect(make().containsBannedPhrase('Get a cheap yoga membership!')).toBe(true);
  });

  it('returns true case-insensitively', () => {
    expect(make().containsBannedPhrase('DISCOUNT membership')).toBe(true);
  });

  it('returns false when text has no banned phrases', () => {
    expect(make().containsBannedPhrase('Transform your wellness journey')).toBe(false);
  });
});

// ── addApprovedPhrase() ────────────────────────────────────────────────────────

describe('BrandKit — addApprovedPhrase()', () => {
  it('adds new phrase', () => {
    const bk = make().addApprovedPhrase('Trust the process', 'admin-1', T1);
    expect(bk.approvedPhrases).toContain('Trust the process');
  });

  it('is a no-op if phrase already exists', () => {
    const bk = make().addApprovedPhrase('Find your flow', 'admin-1', T1);
    expect(bk.approvedPhrases).toHaveLength(2);
  });

  it('throws for empty phrase', () => {
    expect(() => make().addApprovedPhrase('', 'admin-1', T1)).toThrow('phrase cannot be empty');
  });

  it('returns new instance', () => {
    const original = make();
    const updated  = original.addApprovedPhrase('New phrase', 'admin-1', T1);
    expect(original.approvedPhrases).toHaveLength(2);
    expect(updated.approvedPhrases).toHaveLength(3);
    expect(original).not.toBe(updated);
  });
});

// ── removeApprovedPhrase() ─────────────────────────────────────────────────────

describe('BrandKit — removeApprovedPhrase()', () => {
  it('removes an existing phrase', () => {
    const bk = make().removeApprovedPhrase('Find your flow', 'admin-1', T1);
    expect(bk.approvedPhrases).not.toContain('Find your flow');
    expect(bk.approvedPhrases).toHaveLength(1);
  });

  it('is a no-op if phrase does not exist', () => {
    const bk = make().removeApprovedPhrase('Nonexistent phrase', 'admin-1', T1);
    expect(bk.approvedPhrases).toHaveLength(2);
  });
});

// ── addBannedPhrase() ──────────────────────────────────────────────────────────

describe('BrandKit — addBannedPhrase()', () => {
  it('adds a new banned phrase', () => {
    const bk = make().addBannedPhrase('miracle', 'admin-1', T1);
    expect(bk.bannedPhrases).toContain('miracle');
  });

  it('is a no-op if banned phrase already exists', () => {
    const bk = make().addBannedPhrase('cheap', 'admin-1', T1);
    expect(bk.bannedPhrases).toHaveLength(3);
  });

  it('throws for empty phrase', () => {
    expect(() => make().addBannedPhrase('   ', 'admin-1', T1)).toThrow('phrase cannot be empty');
  });
});

// ── addHashtag() ───────────────────────────────────────────────────────────────

describe('BrandKit — addHashtag()', () => {
  it('adds a new hashtag', () => {
    const bk = make().addHashtag('#Mindfulness', 'admin-1', T1);
    expect(bk.defaultHashtags).toContain('#Mindfulness');
  });

  it('is a no-op if hashtag already exists', () => {
    const bk = make().addHashtag('#SohamYoga', 'admin-1', T1);
    expect(bk.defaultHashtags).toHaveLength(2);
  });

  it('throws when hashtag does not start with #', () => {
    expect(() => make().addHashtag('Mindfulness', 'admin-1', T1)).toThrow('hashtag must start with #');
  });
});

// ── removeHashtag() ────────────────────────────────────────────────────────────

describe('BrandKit — removeHashtag()', () => {
  it('removes an existing hashtag', () => {
    const bk = make().removeHashtag('#YogaLife', 'admin-1', T1);
    expect(bk.defaultHashtags).not.toContain('#YogaLife');
    expect(bk.defaultHashtags).toHaveLength(1);
  });
});

// ── updateColors() ─────────────────────────────────────────────────────────────

describe('BrandKit — updateColors()', () => {
  it('updates all three colors', () => {
    const bk = make().updateColors('#FFFFFF', '#000000', '#FF0000', 'admin-1', T1);
    expect(bk.primaryColor).toBe('#FFFFFF');
    expect(bk.secondaryColor).toBe('#000000');
    expect(bk.accentColor).toBe('#FF0000');
    expect(bk.updatedAt).toEqual(T1);
  });

  it('throws for invalid primary color', () => {
    expect(() => make().updateColors('red', '#000000', '#FF0000', 'admin-1', T1))
      .toThrow('primary must be a valid hex color');
  });

  it('throws for invalid secondary color', () => {
    expect(() => make().updateColors('#FFFFFF', '#GGGGGG', '#FF0000', 'admin-1', T1))
      .toThrow('secondary must be a valid hex color');
  });

  it('throws for invalid accent color', () => {
    expect(() => make().updateColors('#FFFFFF', '#000000', '#XYZ', 'admin-1', T1))
      .toThrow('accent must be a valid hex color');
  });

  it('returns new instance', () => {
    const original = make();
    const updated  = original.updateColors('#AABBCC', '#DDEEFF', '#112233', 'admin-1', T1);
    expect(original.primaryColor).toBe('#4F46E5');
    expect(updated.primaryColor).toBe('#AABBCC');
  });
});
