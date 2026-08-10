import { describe, it, expect } from '@jest/globals';
import { WhiteLabelConfig, type WhiteLabelConfigProps } from '../../../domain/enterprise/WhiteLabelConfig';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function make(overrides?: Partial<WhiteLabelConfigProps>): WhiteLabelConfig {
  return new WhiteLabelConfig({
    id:             'wl-1',
    tenantId:       'tenant-1',
    brandName:      'ZenStudio',
    primaryColor:   '#1A2B3C',
    secondaryColor: '#FFFFFF',
    accentColor:    '#FF6600',
    status:         'draft',
    createdAt:      NOW,
    updatedAt:      NOW,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('WhiteLabelConfig — constructor', () => {
  it('creates a draft config', () => {
    const c = make();
    expect(c.status).toBe('draft');
    expect(c.isDraft()).toBe(true);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when tenantId is empty', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws when brandName is empty', () => {
    expect(() => make({ brandName: '' })).toThrow('brandName is required');
  });

  it('throws when primaryColor is not valid hex', () => {
    expect(() => make({ primaryColor: 'red' })).toThrow('primaryColor must be a valid hex');
    expect(() => make({ primaryColor: '#GGGGGG' })).toThrow('primaryColor must be a valid hex');
    expect(() => make({ primaryColor: '#12345' })).toThrow('primaryColor must be a valid hex');
  });

  it('throws when secondaryColor is not valid hex', () => {
    expect(() => make({ secondaryColor: 'white' })).toThrow('secondaryColor must be a valid hex');
  });

  it('throws when accentColor is not valid hex', () => {
    expect(() => make({ accentColor: '#XYZ123' })).toThrow('accentColor must be a valid hex');
  });

  it('accepts both uppercase and lowercase hex', () => {
    expect(() => make({ primaryColor: '#aabbcc' })).not.toThrow();
    expect(() => make({ primaryColor: '#AABBCC' })).not.toThrow();
  });

  it('throws when active but no logoUrl', () => {
    expect(() => make({ status: 'active' })).toThrow('active config requires logoUrl');
  });

  it('creates active config with logoUrl', () => {
    const c = make({ status: 'active', logoUrl: 'https://cdn.example.com/logo.png' });
    expect(c.isActive()).toBe(true);
  });

  it('accepts all optional fields', () => {
    const c = make({
      logoUrl:          'https://cdn.example.com/logo.png',
      faviconUrl:       'https://cdn.example.com/favicon.ico',
      customDomain:     'yoga.example.com',
      supportEmail:     'support@example.com',
      privacyPolicyUrl: 'https://example.com/privacy',
      termsUrl:         'https://example.com/terms',
    });
    expect(c.customDomain).toBe('yoga.example.com');
    expect(c.supportEmail).toBe('support@example.com');
  });
});

// ── activate() ────────────────────────────────────────────────────────────────

describe('activate()', () => {
  it('draft → active when logoUrl is set', () => {
    const c = make({ logoUrl: 'https://cdn.example.com/logo.png' }).activate(LATER);
    expect(c.status).toBe('active');
    expect(c.isActive()).toBe(true);
    expect(c.updatedAt).toEqual(LATER);
  });

  it('inactive → active when logoUrl is set', () => {
    const c = make({ status: 'inactive', logoUrl: 'https://cdn.example.com/logo.png' }).activate(LATER);
    expect(c.status).toBe('active');
  });

  it('throws when already active', () => {
    const active = make({ status: 'active', logoUrl: 'https://cdn.example.com/logo.png' });
    expect(() => active.activate(LATER)).toThrow('already active');
  });

  it('throws when no logoUrl', () => {
    expect(() => make().activate(LATER)).toThrow('logoUrl is required to activate');
  });
});

// ── deactivate() ──────────────────────────────────────────────────────────────

describe('deactivate()', () => {
  it('active → inactive', () => {
    const c = make({ status: 'active', logoUrl: 'https://cdn.example.com/logo.png' }).deactivate(LATER);
    expect(c.status).toBe('inactive');
    expect(c.isInactive()).toBe(true);
    expect(c.updatedAt).toEqual(LATER);
  });

  it('throws when not active', () => {
    expect(() => make().deactivate(LATER)).toThrow('can only deactivate an active');
  });
});

// ── setLogoUrl() ──────────────────────────────────────────────────────────────

describe('setLogoUrl()', () => {
  it('sets logoUrl', () => {
    const c = make().setLogoUrl('https://cdn.example.com/logo.png', LATER);
    expect(c.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(c.updatedAt).toEqual(LATER);
  });

  it('throws when url is empty', () => {
    expect(() => make().setLogoUrl('', NOW)).toThrow('logoUrl is required');
  });
});

// ── setFaviconUrl() ───────────────────────────────────────────────────────────

describe('setFaviconUrl()', () => {
  it('sets faviconUrl', () => {
    const c = make().setFaviconUrl('https://cdn.example.com/favicon.ico', LATER);
    expect(c.faviconUrl).toBe('https://cdn.example.com/favicon.ico');
  });

  it('throws when url is empty', () => {
    expect(() => make().setFaviconUrl('', NOW)).toThrow('faviconUrl is required');
  });
});

// ── setColors() ───────────────────────────────────────────────────────────────

describe('setColors()', () => {
  it('updates all three colors', () => {
    const c = make().setColors('#000000', '#FFFFFF', '#FF0000', LATER);
    expect(c.primaryColor).toBe('#000000');
    expect(c.secondaryColor).toBe('#FFFFFF');
    expect(c.accentColor).toBe('#FF0000');
    expect(c.updatedAt).toEqual(LATER);
  });

  it('throws when primary is invalid', () => {
    expect(() => make().setColors('bad', '#FFFFFF', '#FF0000', NOW))
      .toThrow('primaryColor must be a valid hex');
  });

  it('throws when secondary is invalid', () => {
    expect(() => make().setColors('#000000', 'bad', '#FF0000', NOW))
      .toThrow('secondaryColor must be a valid hex');
  });

  it('throws when accent is invalid', () => {
    expect(() => make().setColors('#000000', '#FFFFFF', 'bad', NOW))
      .toThrow('accentColor must be a valid hex');
  });
});

// ── setCustomDomain() / setBrandName() ────────────────────────────────────────

describe('setCustomDomain() / setBrandName()', () => {
  it('sets custom domain', () => {
    const c = make().setCustomDomain('yoga.example.com', LATER);
    expect(c.customDomain).toBe('yoga.example.com');
    expect(c.updatedAt).toEqual(LATER);
  });

  it('throws when domain is empty', () => {
    expect(() => make().setCustomDomain('', NOW)).toThrow('customDomain is required');
  });

  it('sets brand name', () => {
    const c = make().setBrandName('OmStudio', LATER);
    expect(c.brandName).toBe('OmStudio');
  });

  it('throws when brand name is empty', () => {
    expect(() => make().setBrandName('', NOW)).toThrow('brandName is required');
  });
});

// ── Activate-after-setLogoUrl chain ───────────────────────────────────────────

describe('chain: setLogoUrl → activate', () => {
  it('can activate after setting logoUrl', () => {
    const c = make()
      .setLogoUrl('https://cdn.example.com/logo.png', NOW)
      .activate(LATER);
    expect(c.isActive()).toBe(true);
  });
});

// ── Immutability ──────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('activate does not mutate original', () => {
    const original = make({ logoUrl: 'https://cdn.example.com/logo.png' });
    original.activate(LATER);
    expect(original.status).toBe('draft');
  });

  it('setColors does not mutate original', () => {
    const original = make();
    original.setColors('#111111', '#222222', '#333333', LATER);
    expect(original.primaryColor).toBe('#1A2B3C');
  });
});
