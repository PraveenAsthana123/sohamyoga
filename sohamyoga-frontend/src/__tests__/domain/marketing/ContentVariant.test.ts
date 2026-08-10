import { describe, it, expect } from '@jest/globals';
import {
  ContentVariant,
  ContentVariantProps,
  PLATFORM_LIMITS,
  ContentPlatform,
} from '../../../domain/marketing/ContentVariant';

const T0 = new Date('2026-03-01T00:00:00Z');
const T1 = new Date('2026-03-10T00:00:00Z');
const T2 = new Date('2026-03-15T00:00:00Z');

function make(overrides: Partial<ContentVariantProps> = {}): ContentVariant {
  return new ContentVariant({
    id:             'cv-1',
    tenantId:       'tenant-1',
    platform:       'instagram',
    masterContent:  'Join Soham Yoga this spring — transform your practice.',
    adaptedContent: 'Spring into yoga 🌸 Join us and transform your practice. #SohamYoga #YogaLife',
    hashtags:       ['#SohamYoga', '#YogaLife'],
    isAiGenerated:  false,
    status:         'draft',
    createdAt:      T0,
    updatedAt:      T0,
    ...overrides,
  });
}

// ── PLATFORM_LIMITS catalog ────────────────────────────────────────────────────

describe('PLATFORM_LIMITS catalog', () => {
  const EXPECTED_PLATFORMS: ContentPlatform[] = [
    'facebook', 'instagram', 'linkedin', 'x_twitter', 'threads', 'tiktok',
    'youtube', 'pinterest', 'reddit', 'bluesky', 'mastodon',
    'telegram', 'discord', 'whatsapp_business',
    'email', 'sms', 'push', 'banner', 'blog',
  ];

  it('defines 19 platforms', () => {
    expect(Object.keys(PLATFORM_LIMITS)).toHaveLength(19);
  });

  it.each(EXPECTED_PLATFORMS)('has config for platform: %s', (platform) => {
    expect(PLATFORM_LIMITS[platform]).toBeDefined();
  });

  it('each platform has maxChars, maxHashtags, toneHint, supportsMedia, mediaRatios', () => {
    Object.values(PLATFORM_LIMITS).forEach(cfg => {
      expect(typeof cfg.maxChars).toBe('number');
      expect(typeof cfg.maxHashtags).toBe('number');
      expect(typeof cfg.toneHint).toBe('string');
      expect(typeof cfg.supportsMedia).toBe('boolean');
      expect(Array.isArray(cfg.mediaRatios)).toBe(true);
    });
  });

  it('x_twitter has maxChars = 280', () => {
    expect(PLATFORM_LIMITS.x_twitter.maxChars).toBe(280);
  });

  it('sms has maxChars = 160', () => {
    expect(PLATFORM_LIMITS.sms.maxChars).toBe(160);
  });

  it('push has maxChars = 100', () => {
    expect(PLATFORM_LIMITS.push.maxChars).toBe(100);
  });

  it('email has maxChars = -1 (unlimited)', () => {
    expect(PLATFORM_LIMITS.email.maxChars).toBe(-1);
  });

  it('blog has maxChars = -1 (unlimited)', () => {
    expect(PLATFORM_LIMITS.blog.maxChars).toBe(-1);
  });

  it('instagram has maxHashtags = 30', () => {
    expect(PLATFORM_LIMITS.instagram.maxHashtags).toBe(30);
  });

  it('sms and push have supportsMedia = false', () => {
    expect(PLATFORM_LIMITS.sms.supportsMedia).toBe(false);
    expect(PLATFORM_LIMITS.push.supportsMedia).toBe(false);
  });

  it('instagram supports media', () => {
    expect(PLATFORM_LIMITS.instagram.supportsMedia).toBe(true);
  });
});

// ── Constructor validation ─────────────────────────────────────────────────────

describe('ContentVariant — constructor validation', () => {
  it('constructs a valid instagram variant', () => {
    const cv = make();
    expect(cv.id).toBe('cv-1');
    expect(cv.platform).toBe('instagram');
    expect(cv.status).toBe('draft');
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when masterContent is blank', () => {
    expect(() => make({ masterContent: '   ' })).toThrow('masterContent is required');
  });

  it('throws when adaptedContent is blank', () => {
    expect(() => make({ adaptedContent: '   ' })).toThrow('adaptedContent is required');
  });

  it('throws when adaptedContent exceeds platform char limit', () => {
    const longSms = 'a'.repeat(161);
    expect(() => make({ platform: 'sms', adaptedContent: longSms, hashtags: [] }))
      .toThrow('exceeds 160 char limit for sms');
  });

  it('throws when too many hashtags for platform', () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => `#tag${i}`);
    expect(() => make({ hashtags: tooMany })).toThrow('too many hashtags');
  });

  it('throws when email variant is approved without adaptedSubject', () => {
    expect(() => make({
      platform:       'email',
      status:         'approved',
      approvedBy:     'mgr',
      adaptedSubject: undefined,
    })).toThrow('adaptedSubject required for email variants');
  });

  it('throws when status is approved without approvedBy', () => {
    expect(() => make({ status: 'approved', approvedBy: undefined }))
      .toThrow('approvedBy required when status is approved');
  });

  it('accepts unlimited-length content for email platform', () => {
    const longEmail = 'a'.repeat(10000);
    expect(() => make({ platform: 'email', adaptedContent: longEmail })).not.toThrow();
  });

  it('accepts 0 hashtags for platforms that disallow them', () => {
    expect(() => make({ platform: 'sms', adaptedContent: 'Short.', hashtags: [] })).not.toThrow();
  });
});

// ── Computed properties ────────────────────────────────────────────────────────

describe('ContentVariant — computed properties', () => {
  it('characterCount returns adaptedContent length', () => {
    const cv = make();
    expect(cv.characterCount).toBe(cv.adaptedContent.length);
  });

  it('platformConfig returns PLATFORM_LIMITS entry', () => {
    const cv = make();
    expect(cv.platformConfig).toBe(PLATFORM_LIMITS['instagram']);
  });

  it('isWithinCharLimit returns true for content within limit', () => {
    expect(make().isWithinCharLimit()).toBe(true);
  });

  it('isWithinCharLimit returns true for unlimited platforms', () => {
    const cv = make({ platform: 'email', adaptedContent: 'a'.repeat(50000) });
    expect(cv.isWithinCharLimit()).toBe(true);
  });

  it('hashtags getter returns a copy', () => {
    const cv = make();
    cv.hashtags.push('#extra');
    expect(cv.hashtags).toHaveLength(2);
  });
});

// ── Status predicates ──────────────────────────────────────────────────────────

describe('ContentVariant — status predicates', () => {
  it('isDraft() for new variant', () => {
    expect(make().isDraft()).toBe(true);
  });

  it('isApproved() after approve()', () => {
    const cv = make().approve('mgr-1', T1);
    expect(cv.isApproved()).toBe(true);
    expect(cv.isDraft()).toBe(false);
  });

  it('isPublished() after markPublished()', () => {
    const cv = make().approve('mgr-1', T1).markPublished(T2);
    expect(cv.isPublished()).toBe(true);
  });
});

// ── approve() ─────────────────────────────────────────────────────────────────

describe('ContentVariant — approve()', () => {
  it('transitions draft → approved', () => {
    const cv = make().approve('mgr-1', T1);
    expect(cv.status).toBe('approved');
    expect(cv.approvedBy).toBe('mgr-1');
    expect(cv.updatedAt).toEqual(T1);
  });

  it('throws if not draft', () => {
    const cv = make().approve('mgr-1', T1);
    expect(() => cv.approve('mgr-2', T2)).toThrow('Can only approve draft variants');
  });

  it('throws for email variant without subject', () => {
    const cv = make({ platform: 'email', adaptedContent: 'Body text' });
    expect(() => cv.approve('mgr-1', T1)).toThrow('adaptedSubject required before approving email variant');
  });

  it('approves email variant when subject is present', () => {
    const cv = make({ platform: 'email', adaptedContent: 'Body text', adaptedSubject: 'Subject here' });
    expect(() => cv.approve('mgr-1', T1)).not.toThrow();
  });
});

// ── markPublished() ───────────────────────────────────────────────────────────

describe('ContentVariant — markPublished()', () => {
  it('transitions approved → published with publishedAt', () => {
    const cv = make().approve('mgr-1', T1).markPublished(T2);
    expect(cv.status).toBe('published');
    expect(cv.publishedAt).toEqual(T2);
  });

  it('throws if not approved', () => {
    expect(() => make().markPublished(T1)).toThrow('Can only publish approved variants');
  });
});

// ── updateContent() ───────────────────────────────────────────────────────────

describe('ContentVariant — updateContent()', () => {
  it('resets approved variant to draft', () => {
    const cv = make().approve('mgr-1', T1).updateContent('New caption #Yoga', undefined, T2);
    expect(cv.status).toBe('draft');
    expect(cv.approvedBy).toBeUndefined();
  });

  it('updates adaptedContent and subject', () => {
    const cv = make({ platform: 'email', adaptedContent: 'Old', adaptedSubject: 'Old subject' })
      .updateContent('New body', 'New subject', T1);
    expect(cv.adaptedContent).toBe('New body');
    expect(cv.adaptedSubject).toBe('New subject');
  });

  it('throws for empty adaptedContent', () => {
    expect(() => make().updateContent('   ', undefined, T1)).toThrow('adaptedContent cannot be empty');
  });

  it('throws when updated content exceeds platform limit', () => {
    expect(() => make({ platform: 'push', adaptedContent: 'Short' })
      .updateContent('x'.repeat(101), undefined, T1)
    ).toThrow('exceeds 100 char limit for push');
  });

  it('throws if variant is published', () => {
    const cv = make().approve('mgr-1', T1).markPublished(T2);
    expect(() => cv.updateContent('Edit', undefined, T2)).toThrow('Cannot edit a published content variant');
  });
});

// ── Immutability ───────────────────────────────────────────────────────────────

describe('ContentVariant — immutability', () => {
  it('approve() returns new instance', () => {
    const draft    = make();
    const approved = draft.approve('mgr-1', T1);
    expect(draft.status).toBe('draft');
    expect(approved.status).toBe('approved');
    expect(draft).not.toBe(approved);
  });
});
