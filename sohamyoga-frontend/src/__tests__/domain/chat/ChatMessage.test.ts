import { describe, it, expect } from '@jest/globals';
import { ChatMessage, type Attachment } from '../../../domain/chat/ChatMessage';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');
const EVEN_LATER = new Date('2026-08-05T12:00:00Z');

const ATT: Attachment = { id: 'att-1', name: 'photo.jpg', url: '/uploads/photo.jpg', mimeType: 'image/jpeg', sizeBytes: 204800 };

function makeMsg(overrides: Partial<ConstructorParameters<typeof ChatMessage>[0]> = {}): ChatMessage {
  return new ChatMessage({
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'cust-1',
    senderType: 'customer',
    messageType: 'text',
    content: 'Hello, I need help.',
    attachments: [],
    isPrivate: false,
    reactions: {},
    createdAt: NOW,
    ...overrides,
  });
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('ChatMessage — construction', () => {
  it('creates a valid text message', () => {
    const m = makeMsg();
    expect(m.id).toBe('msg-1');
    expect(m.senderType).toBe('customer');
    expect(m.content).toBe('Hello, I need help.');
    expect(m.isDelivered()).toBe(false);
    expect(m.isRead()).toBe(false);
  });

  it('throws when id is missing', () => {
    expect(() => makeMsg({ id: '' })).toThrow('id is required');
  });

  it('throws when conversationId is missing', () => {
    expect(() => makeMsg({ conversationId: '' })).toThrow('conversationId is required');
  });

  it('throws when senderId is missing', () => {
    expect(() => makeMsg({ senderId: '' })).toThrow('senderId is required');
  });

  it('throws when text message has empty content', () => {
    expect(() => makeMsg({ messageType: 'text', content: '   ' })).toThrow('content is required for text messages');
  });

  it('allows empty content for non-text message types', () => {
    expect(() => makeMsg({ messageType: 'image', content: '' })).not.toThrow();
    expect(() => makeMsg({ messageType: 'file',  content: '' })).not.toThrow();
  });

  it('throws when non-agent tries to send private message', () => {
    expect(() => makeMsg({ isPrivate: true, senderType: 'customer' })).toThrow('only agents can send private messages');
    expect(() => makeMsg({ isPrivate: true, senderType: 'bot' })).toThrow('only agents can send private messages');
  });

  it('allows agent to send private message', () => {
    expect(() => makeMsg({ isPrivate: true, senderType: 'agent' })).not.toThrow();
  });

  it('throws when readAt is set without deliveredAt', () => {
    expect(() => makeMsg({ readAt: LATER, deliveredAt: undefined })).toThrow('must be delivered before it can be read');
  });

  it('throws when deliveredAt is before createdAt', () => {
    const before = new Date('2026-08-05T09:00:00Z');
    expect(() => makeMsg({ deliveredAt: before })).toThrow('deliveredAt must be after createdAt');
  });

  it('accepts with attachment', () => {
    const m = makeMsg({ attachments: [ATT] });
    expect(m.hasAttachments()).toBe(true);
    expect(m.attachments[0].name).toBe('photo.jpg');
  });

  it('attachments array is defensive copy', () => {
    const m = makeMsg({ attachments: [ATT] });
    m.attachments.push({ ...ATT, id: 'att-2' });
    expect(m.attachments).toHaveLength(1);
  });

  it('accepts thread reply with parentMessageId', () => {
    const m = makeMsg({ parentMessageId: 'msg-0' });
    expect(m.isThreadReply()).toBe(true);
  });
});

// ── markDelivered() ───────────────────────────────────────────────────────────

describe('markDelivered()', () => {
  it('sets deliveredAt', () => {
    const m = makeMsg().markDelivered(LATER);
    expect(m.isDelivered()).toBe(true);
    expect(m.deliveredAt).toEqual(LATER);
  });

  it('throws when already delivered', () => {
    expect(() => makeMsg({ deliveredAt: LATER }).markDelivered(EVEN_LATER)).toThrow('already delivered');
  });

  it('does not mutate original', () => {
    const m = makeMsg();
    m.markDelivered(LATER);
    expect(m.isDelivered()).toBe(false);
  });
});

// ── markRead() ────────────────────────────────────────────────────────────────

describe('markRead()', () => {
  it('sets readAt after delivery', () => {
    const m = makeMsg({ deliveredAt: LATER }).markRead(EVEN_LATER);
    expect(m.isRead()).toBe(true);
    expect(m.readAt).toEqual(EVEN_LATER);
  });

  it('throws when not delivered', () => {
    expect(() => makeMsg().markRead(LATER)).toThrow('must be delivered before it can be read');
  });

  it('throws when already read', () => {
    const m = makeMsg({ deliveredAt: LATER, readAt: LATER });
    expect(() => m.markRead(EVEN_LATER)).toThrow('already read');
  });
});

// ── addReaction() / removeReaction() ──────────────────────────────────────────

describe('addReaction()', () => {
  it('adds an emoji reaction', () => {
    const m = makeMsg().addReaction('❤️', 'cust-1');
    expect(m.reactions['❤️']).toEqual(['cust-1']);
  });

  it('multiple users can react with same emoji', () => {
    const m = makeMsg().addReaction('❤️', 'cust-1').addReaction('❤️', 'ag-1');
    expect(m.reactions['❤️']).toHaveLength(2);
  });

  it('throws when emoji is empty', () => {
    expect(() => makeMsg().addReaction('', 'cust-1')).toThrow('emoji is required');
  });

  it('throws when senderId is empty', () => {
    expect(() => makeMsg().addReaction('❤️', '')).toThrow('senderId is required');
  });

  it('throws when same user reacts twice with same emoji', () => {
    expect(() => makeMsg().addReaction('❤️', 'cust-1').addReaction('❤️', 'cust-1')).toThrow('already reacted');
  });
});

describe('removeReaction()', () => {
  it('removes a reaction', () => {
    const m = makeMsg().addReaction('❤️', 'cust-1').removeReaction('❤️', 'cust-1');
    expect(m.reactions['❤️']).toBeUndefined();
  });

  it('removes emoji key entirely when last reactor removes it', () => {
    const m = makeMsg().addReaction('👍', 'a').addReaction('👍', 'b').removeReaction('👍', 'a');
    expect(m.reactions['👍']).toEqual(['b']);
  });

  it('throws when reaction not found', () => {
    expect(() => makeMsg().removeReaction('❤️', 'cust-1')).toThrow('not found');
  });

  it('reactions map is defensive copy', () => {
    const m = makeMsg().addReaction('❤️', 'cust-1');
    const r = m.reactions;
    r['❤️'].push('spy');
    expect(m.reactions['❤️']).toHaveLength(1);
  });
});

// ── editContent() ─────────────────────────────────────────────────────────────

describe('editContent()', () => {
  it('updates content and sets editedAt', () => {
    const m = makeMsg().editContent('Updated message.', LATER);
    expect(m.content).toBe('Updated message.');
    expect(m.isEdited()).toBe(true);
    expect(m.editedAt).toEqual(LATER);
  });

  it('throws when content is empty', () => {
    expect(() => makeMsg().editContent('   ', LATER)).toThrow('cannot be empty');
  });

  it('throws for system messages', () => {
    expect(() => makeMsg({ senderType: 'system', messageType: 'system_event' }).editContent('x', LATER))
      .toThrow('system messages cannot be edited');
  });

  it('does not mutate original', () => {
    const m = makeMsg();
    m.editContent('Changed', LATER);
    expect(m.content).toBe('Hello, I need help.');
  });
});

// ── Predicates ────────────────────────────────────────────────────────────────

describe('predicates', () => {
  it('isEdited false by default', () => expect(makeMsg().isEdited()).toBe(false));
  it('isThreadReply false without parentMessageId', () => expect(makeMsg().isThreadReply()).toBe(false));
  it('hasAttachments false when empty', () => expect(makeMsg().hasAttachments()).toBe(false));
});
