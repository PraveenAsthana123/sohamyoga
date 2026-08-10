export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'snoozed';
export type ChatChannel = 'web' | 'whatsapp' | 'telegram' | 'email' | 'voice' | 'video' | 'sms';
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';

interface ChatConversationProps {
  id: string;
  customerId: string;
  channel: ChatChannel;
  status: ConversationStatus;
  priority: ConversationPriority;
  subject?: string;
  assignedAgentId?: string;
  assignedBotId?: string;
  tags: string[];
  lastActivityAt: Date;
  openedAt: Date;
  resolvedAt?: Date;
  snoozeUntil?: Date;
  satisfactionScore?: number;   // 1-5
  satisfactionFeedback?: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ChatConversation {
  private readonly props: ChatConversationProps;

  constructor(props: ChatConversationProps) {
    if (!props.id)         throw new Error('id is required');
    if (!props.customerId) throw new Error('customerId is required');
    if (props.messageCount < 0) throw new Error('messageCount cannot be negative');
    if (
      props.satisfactionScore !== undefined &&
      (props.satisfactionScore < 1 || props.satisfactionScore > 5)
    ) throw new Error('satisfactionScore must be 1-5');
    if (props.status === 'resolved' && !props.resolvedAt)
      throw new Error('resolvedAt is required when status is resolved');
    if (props.status === 'snoozed' && !props.snoozeUntil)
      throw new Error('snoozeUntil is required when status is snoozed');
    if (props.snoozeUntil && props.snoozeUntil <= props.openedAt)
      throw new Error('snoozeUntil must be after openedAt');
    this.props = { ...props, tags: [...props.tags] };
  }

  get id()                   { return this.props.id; }
  get customerId()           { return this.props.customerId; }
  get channel()              { return this.props.channel; }
  get status()               { return this.props.status; }
  get priority()             { return this.props.priority; }
  get subject()              { return this.props.subject; }
  get assignedAgentId()      { return this.props.assignedAgentId; }
  get assignedBotId()        { return this.props.assignedBotId; }
  get tags()                 { return [...this.props.tags]; }
  get lastActivityAt()       { return this.props.lastActivityAt; }
  get openedAt()             { return this.props.openedAt; }
  get resolvedAt()           { return this.props.resolvedAt; }
  get snoozeUntil()          { return this.props.snoozeUntil; }
  get satisfactionScore()    { return this.props.satisfactionScore; }
  get satisfactionFeedback() { return this.props.satisfactionFeedback; }
  get messageCount()         { return this.props.messageCount; }
  get createdAt()            { return this.props.createdAt; }
  get updatedAt()            { return this.props.updatedAt; }

  isOpen()     { return this.props.status === 'open'; }
  isPending()  { return this.props.status === 'pending'; }
  isResolved() { return this.props.status === 'resolved'; }
  isSnoozed()  { return this.props.status === 'snoozed'; }
  isAssigned() { return !!this.props.assignedAgentId; }
  hasBotAssigned() { return !!this.props.assignedBotId; }

  assign(agentId: string, at: Date): ChatConversation {
    if (!agentId) throw new Error('agentId is required');
    if (this.props.status === 'resolved') throw new Error('cannot assign a resolved conversation');
    if (this.props.assignedAgentId === agentId) throw new Error('agent is already assigned');
    return new ChatConversation({
      ...this.props, tags: [...this.props.tags],
      assignedAgentId: agentId, status: 'open',
      lastActivityAt: at, updatedAt: at,
    });
  }

  unassign(at: Date): ChatConversation {
    if (!this.props.assignedAgentId) throw new Error('no agent assigned');
    return new ChatConversation({
      ...this.props, tags: [...this.props.tags],
      assignedAgentId: undefined, status: 'pending',
      lastActivityAt: at, updatedAt: at,
    });
  }

  resolve(at: Date): ChatConversation {
    if (this.props.status === 'resolved') throw new Error('conversation is already resolved');
    return new ChatConversation({
      ...this.props, tags: [...this.props.tags],
      status: 'resolved', resolvedAt: at,
      lastActivityAt: at, updatedAt: at,
    });
  }

  reopen(at: Date): ChatConversation {
    if (this.props.status === 'open')    throw new Error('conversation is already open');
    if (this.props.status === 'pending') throw new Error('conversation is already pending');
    return new ChatConversation({
      ...this.props, tags: [...this.props.tags],
      status: 'open', resolvedAt: undefined, snoozeUntil: undefined,
      lastActivityAt: at, updatedAt: at,
    });
  }

  snooze(until: Date, at: Date): ChatConversation {
    if (this.props.status === 'resolved') throw new Error('cannot snooze a resolved conversation');
    if (this.props.status === 'snoozed')  throw new Error('conversation is already snoozed');
    if (until <= at) throw new Error('snoozeUntil must be in the future');
    return new ChatConversation({
      ...this.props, tags: [...this.props.tags],
      status: 'snoozed', snoozeUntil: until, updatedAt: at,
    });
  }

  escalate(at: Date): ChatConversation {
    if (this.props.priority === 'urgent') throw new Error('conversation is already urgent');
    return new ChatConversation({
      ...this.props, tags: [...this.props.tags],
      priority: 'urgent', lastActivityAt: at, updatedAt: at,
    });
  }

  addTag(tag: string, at: Date): ChatConversation {
    if (!tag) throw new Error('tag is required');
    if (this.props.tags.includes(tag)) throw new Error(`tag "${tag}" already exists`);
    return new ChatConversation({ ...this.props, tags: [...this.props.tags, tag], updatedAt: at });
  }

  removeTag(tag: string, at: Date): ChatConversation {
    if (!this.props.tags.includes(tag)) throw new Error(`tag "${tag}" not found`);
    return new ChatConversation({
      ...this.props, tags: this.props.tags.filter(t => t !== tag), updatedAt: at,
    });
  }

  setSatisfaction(score: number, feedback: string | undefined, at: Date): ChatConversation {
    if (!this.isResolved()) throw new Error('satisfaction can only be set on resolved conversations');
    if (score < 1 || score > 5) throw new Error('satisfactionScore must be 1-5');
    return new ChatConversation({
      ...this.props, tags: [...this.props.tags],
      satisfactionScore: score, satisfactionFeedback: feedback, updatedAt: at,
    });
  }

  incrementMessageCount(at: Date): ChatConversation {
    return new ChatConversation({
      ...this.props, tags: [...this.props.tags],
      messageCount: this.props.messageCount + 1,
      lastActivityAt: at, updatedAt: at,
    });
  }
}
