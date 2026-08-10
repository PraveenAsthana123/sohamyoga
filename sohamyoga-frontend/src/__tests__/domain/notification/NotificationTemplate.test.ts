import { describe, it, expect } from '@jest/globals';
import {
  NotificationTemplate,
  TEMPLATE_SLUGS,
  type NotificationTemplateProps,
} from '../../../domain/notification/NotificationTemplate';

const T0 = new Date('2026-01-01T00:00:00Z');
const T1 = new Date('2026-01-02T00:00:00Z');
const T2 = new Date('2026-01-03T00:00:00Z');

function makeTemplate(overrides: Partial<NotificationTemplateProps> = {}): NotificationTemplate {
  return new NotificationTemplate({
    id:        'nt-1',
    tenantId:  'tenant-1',
    slug:      'booking_reminder_email',
    name:      'Booking Reminder',
    channel:   'email',
    type:      'reminder',
    subject:   'Your yoga class is tomorrow',
    body:      'Hi {{name}}, your class {{class_name}} is at {{class_time}}.',
    variables: ['name', 'class_name', 'class_time'],
    locale:    'en',
    status:    'draft',
    version:   1,
    createdBy: 'u-admin',
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  });
}

// ── Constructor validation ─────────────────────────────────────────────────────

describe('NotificationTemplate — constructor', () => {
  it('creates a valid draft email template', () => {
    const t = makeTemplate();
    expect(t.id).toBe('nt-1');
    expect(t.status).toBe('draft');
    expect(t.version).toBe(1);
    expect(t.channel).toBe('email');
  });

  it('throws if id is missing', () => {
    expect(() => makeTemplate({ id: '' })).toThrow('id is required');
  });

  it('throws if tenantId is missing', () => {
    expect(() => makeTemplate({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws if slug is not snake_case', () => {
    expect(() => makeTemplate({ slug: 'Booking Reminder' })).toThrow('snake_case');
  });

  it('throws if slug starts with a number', () => {
    expect(() => makeTemplate({ slug: '1booking' })).toThrow('snake_case');
  });

  it('throws if name is empty', () => {
    expect(() => makeTemplate({ name: '  ' })).toThrow('name is required');
  });

  it('throws if body is empty', () => {
    expect(() => makeTemplate({ body: '' })).toThrow('body is required');
  });

  it('throws if email channel has no subject', () => {
    expect(() => makeTemplate({ subject: undefined })).toThrow('subject is required for email channel');
  });

  it('throws if email channel has blank subject', () => {
    expect(() => makeTemplate({ subject: '  ' })).toThrow('subject is required for email channel');
  });

  it('accepts SMS template without subject', () => {
    const t = makeTemplate({ channel: 'sms', subject: undefined });
    expect(t.channel).toBe('sms');
    expect(t.subject).toBeUndefined();
  });

  it('throws if version is 0', () => {
    expect(() => makeTemplate({ version: 0 })).toThrow('version must be >= 1');
  });

  it('throws if approved status has no approvedBy', () => {
    expect(() => makeTemplate({ status: 'approved' })).toThrow('approvedBy required');
  });

  it('throws if active status has no approvedBy', () => {
    expect(() => makeTemplate({ status: 'active' })).toThrow('approvedBy required');
  });

  it('accepts approved status with approvedBy', () => {
    const t = makeTemplate({ status: 'approved', approvedBy: 'u-manager', approvedAt: T1 });
    expect(t.status).toBe('approved');
    expect(t.approvedBy).toBe('u-manager');
  });

  it('variables getter returns a copy', () => {
    const t = makeTemplate();
    const vars = t.variables;
    vars.push('extra');
    expect(t.variables).toHaveLength(3);
  });
});

// ── State helpers ─────────────────────────────────────────────────────────────

describe('NotificationTemplate — state helpers', () => {
  it('isDraft() true for draft status', () => {
    expect(makeTemplate().isDraft()).toBe(true);
  });

  it('isActive() false for draft', () => {
    expect(makeTemplate().isActive()).toBe(false);
  });

  it('isArchived() true for archived status', () => {
    const t = makeTemplate({ status: 'archived' });
    expect(t.isArchived()).toBe(true);
  });
});

// ── approve() ─────────────────────────────────────────────────────────────────

describe('NotificationTemplate — approve()', () => {
  it('transitions draft → approved', () => {
    const t2 = makeTemplate().approve('u-manager', T1);
    expect(t2.status).toBe('approved');
    expect(t2.approvedBy).toBe('u-manager');
    expect(t2.approvedAt).toEqual(T1);
    expect(t2.updatedAt).toEqual(T1);
  });

  it('throws if not draft', () => {
    const approved = makeTemplate({ status: 'approved', approvedBy: 'u-m' });
    expect(() => approved.approve('u-m2', T2)).toThrow('Can only approve draft templates');
  });

  it('does not mutate original', () => {
    const t = makeTemplate();
    t.approve('u-m', T1);
    expect(t.status).toBe('draft');
    expect(t.approvedBy).toBeUndefined();
  });
});

// ── activate() ────────────────────────────────────────────────────────────────

describe('NotificationTemplate — activate()', () => {
  it('transitions approved → active', () => {
    const t2 = makeTemplate({ status: 'approved', approvedBy: 'u-m' }).activate(T1);
    expect(t2.status).toBe('active');
    expect(t2.updatedAt).toEqual(T1);
  });

  it('throws if not approved', () => {
    expect(() => makeTemplate().activate(T1)).toThrow('Can only activate approved templates');
  });

  it('throws if archived', () => {
    const t = makeTemplate({ status: 'archived' });
    expect(() => t.activate(T1)).toThrow('Can only activate approved templates');
  });
});

// ── archive() ─────────────────────────────────────────────────────────────────

describe('NotificationTemplate — archive()', () => {
  it('archives a draft template', () => {
    expect(makeTemplate().archive(T1).status).toBe('archived');
  });

  it('archives an active template', () => {
    const t = makeTemplate({ status: 'active', approvedBy: 'u-m' });
    expect(t.archive(T1).status).toBe('archived');
  });

  it('throws if already archived', () => {
    expect(() => makeTemplate({ status: 'archived' }).archive(T1)).toThrow('already archived');
  });
});

// ── updateContent() ───────────────────────────────────────────────────────────

describe('NotificationTemplate — updateContent()', () => {
  it('increments version and resets to draft', () => {
    const t = makeTemplate({ status: 'active', approvedBy: 'u-m' });
    const t2 = t.updateContent('New body {{name}}', 'New subject', 'u-editor', T1);
    expect(t2.version).toBe(2);
    expect(t2.status).toBe('draft');
    expect(t2.approvedBy).toBeUndefined();
    expect(t2.body).toBe('New body {{name}}');
    expect(t2.subject).toBe('New subject');
  });

  it('throws if body is empty', () => {
    expect(() => makeTemplate().updateContent('', 'Subject', 'u-e', T1)).toThrow('body cannot be empty');
  });

  it('throws if email subject is missing after update', () => {
    expect(() => makeTemplate().updateContent('New body', undefined, 'u-e', T1))
      .toThrow('subject is required for email channel');
  });

  it('throws if template is archived', () => {
    expect(() => makeTemplate({ status: 'archived' }).updateContent('New body', 'Subj', 'u-e', T1))
      .toThrow('Cannot edit an archived template');
  });

  it('does not mutate original', () => {
    const t = makeTemplate();
    t.updateContent('New body', 'New subj', 'u-e', T1);
    expect(t.version).toBe(1);
    expect(t.body).toContain('{{name}}');
  });
});

// ── TEMPLATE_SLUGS catalog ────────────────────────────────────────────────────

describe('TEMPLATE_SLUGS catalog', () => {
  it('has at least 20 entries', () => {
    expect(TEMPLATE_SLUGS.length).toBeGreaterThanOrEqual(20);
  });

  it('all slugs are snake_case', () => {
    TEMPLATE_SLUGS.forEach(slug => {
      expect(slug).toMatch(/^[a-z][a-z0-9_]+$/);
    });
  });

  it('includes booking_reminder_email', () => {
    expect(TEMPLATE_SLUGS).toContain('booking_reminder_email');
  });

  it('includes otp_verification_sms', () => {
    expect(TEMPLATE_SLUGS).toContain('otp_verification_sms');
  });

  it('all slugs are unique', () => {
    expect(new Set(TEMPLATE_SLUGS).size).toBe(TEMPLATE_SLUGS.length);
  });
});
