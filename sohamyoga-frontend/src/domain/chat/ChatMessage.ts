export type SenderType  = 'customer' | 'agent' | 'bot' | 'system';
export type MessageType = 'text' | 'image' | 'file' | 'voice' | 'video' | 'emoji_reaction' | 'system_event';

export interface Attachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

interface ChatMessageProps {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: SenderType;
  messageType: MessageType;
  content: string;
  attachments: Attachment[];
  isPrivate: boolean;
  parentMessageId?: string;
  reactions: Record<string, string[]>;   // emoji → list of senderIds
  deliveredAt?: Date;
  readAt?: Date;
  editedAt?: Date;
  createdAt: Date;
}

export class ChatMessage {
  private readonly props: ChatMessageProps;

  constructor(props: ChatMessageProps) {
    if (!props.id)             throw new Error('id is required');
    if (!props.conversationId) throw new Error('conversationId is required');
    if (!props.senderId)       throw new Error('senderId is required');
    if (props.messageType === 'text' && !props.content.trim())
      throw new Error('content is required for text messages');
    if (props.isPrivate && props.senderType !== 'agent')
      throw new Error('only agents can send private messages');
    if (props.readAt && !props.deliveredAt)
      throw new Error('message must be delivered before it can be read');
    if (props.deliveredAt && props.deliveredAt < props.createdAt)
      throw new Error('deliveredAt must be after createdAt');
    if (props.readAt && props.readAt < props.createdAt)
      throw new Error('readAt must be after createdAt');

    this.props = {
      ...props,
      attachments: props.attachments.map(a => ({ ...a })),
      reactions: Object.fromEntries(
        Object.entries(props.reactions).map(([k, v]) => [k, [...v]])
      ),
    };
  }

  get id()              { return this.props.id; }
  get conversationId()  { return this.props.conversationId; }
  get senderId()        { return this.props.senderId; }
  get senderType()      { return this.props.senderType; }
  get messageType()     { return this.props.messageType; }
  get content()         { return this.props.content; }
  get attachments()     { return this.props.attachments.map(a => ({ ...a })); }
  get isPrivate()       { return this.props.isPrivate; }
  get parentMessageId() { return this.props.parentMessageId; }
  get reactions() {
    return Object.fromEntries(
      Object.entries(this.props.reactions).map(([k, v]) => [k, [...v]])
    );
  }
  get deliveredAt() { return this.props.deliveredAt; }
  get readAt()      { return this.props.readAt; }
  get editedAt()    { return this.props.editedAt; }
  get createdAt()   { return this.props.createdAt; }

  isDelivered()    { return !!this.props.deliveredAt; }
  isRead()         { return !!this.props.readAt; }
  hasAttachments() { return this.props.attachments.length > 0; }
  isThreadReply()  { return !!this.props.parentMessageId; }
  isEdited()       { return !!this.props.editedAt; }

  private clone(patch: Partial<ChatMessageProps>): ChatMessage {
    return new ChatMessage({
      ...this.props,
      attachments: this.props.attachments.map(a => ({ ...a })),
      reactions: Object.fromEntries(Object.entries(this.props.reactions).map(([k, v]) => [k, [...v]])),
      ...patch,
    });
  }

  markDelivered(at: Date): ChatMessage {
    if (this.props.deliveredAt) throw new Error('message is already delivered');
    return this.clone({ deliveredAt: at });
  }

  markRead(at: Date): ChatMessage {
    if (!this.props.deliveredAt) throw new Error('message must be delivered before it can be read');
    if (this.props.readAt)       throw new Error('message is already read');
    return this.clone({ readAt: at });
  }

  addReaction(emoji: string, senderId: string): ChatMessage {
    if (!emoji)    throw new Error('emoji is required');
    if (!senderId) throw new Error('senderId is required');
    const current = this.props.reactions[emoji] ?? [];
    if (current.includes(senderId)) throw new Error(`${senderId} already reacted with ${emoji}`);
    return this.clone({
      reactions: { ...this.props.reactions, [emoji]: [...current, senderId] },
    });
  }

  removeReaction(emoji: string, senderId: string): ChatMessage {
    const current = this.props.reactions[emoji] ?? [];
    if (!current.includes(senderId)) throw new Error(`reaction "${emoji}" by ${senderId} not found`);
    const updated = current.filter(id => id !== senderId);
    const reactions = { ...this.props.reactions };
    if (updated.length === 0) delete reactions[emoji];
    else reactions[emoji] = updated;
    return this.clone({ reactions });
  }

  editContent(content: string, at: Date): ChatMessage {
    if (this.props.senderType === 'system') throw new Error('system messages cannot be edited');
    if (!content.trim()) throw new Error('content cannot be empty');
    return this.clone({ content, editedAt: at });
  }
}
