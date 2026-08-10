export type AgentStatus = 'online' | 'offline' | 'busy' | 'away';
export type AgentRole   = 'agent' | 'supervisor' | 'admin';

interface ChatAgentProps {
  id: string;
  userId: string;
  displayName: string;
  role: AgentRole;
  status: AgentStatus;
  maxConcurrentChats: number;
  skillTags: string[];
  assignedConversationIds: string[];
  avgResponseTimeSeconds?: number;
  satisfactionScore?: number;   // 0-100
  shiftStart?: string;          // HH:MM
  shiftEnd?: string;            // HH:MM
  createdAt: Date;
  updatedAt: Date;
}

export class ChatAgent {
  private readonly props: ChatAgentProps;

  constructor(props: ChatAgentProps) {
    if (!props.id)          throw new Error('id is required');
    if (!props.userId)      throw new Error('userId is required');
    if (!props.displayName) throw new Error('displayName is required');
    if (props.maxConcurrentChats < 1)
      throw new Error('maxConcurrentChats must be at least 1');
    if (
      props.satisfactionScore !== undefined &&
      (props.satisfactionScore < 0 || props.satisfactionScore > 100)
    ) throw new Error('satisfactionScore must be 0-100');
    this.props = {
      ...props,
      skillTags:               [...props.skillTags],
      assignedConversationIds: [...props.assignedConversationIds],
    };
  }

  get id()                       { return this.props.id; }
  get userId()                   { return this.props.userId; }
  get displayName()              { return this.props.displayName; }
  get role()                     { return this.props.role; }
  get status()                   { return this.props.status; }
  get maxConcurrentChats()       { return this.props.maxConcurrentChats; }
  get skillTags()                { return [...this.props.skillTags]; }
  get assignedConversationIds()  { return [...this.props.assignedConversationIds]; }
  get avgResponseTimeSeconds()   { return this.props.avgResponseTimeSeconds; }
  get satisfactionScore()        { return this.props.satisfactionScore; }
  get shiftStart()               { return this.props.shiftStart; }
  get shiftEnd()                 { return this.props.shiftEnd; }
  get createdAt()                { return this.props.createdAt; }
  get updatedAt()                { return this.props.updatedAt; }

  isOnline()      { return this.props.status === 'online'; }
  isAvailable()   { return this.isOnline() && !this.isAtCapacity(); }
  currentLoad()   { return this.props.assignedConversationIds.length; }
  isAtCapacity()  { return this.currentLoad() >= this.props.maxConcurrentChats; }

  private clone(patch: Partial<ChatAgentProps>): ChatAgent {
    return new ChatAgent({
      ...this.props,
      skillTags:               [...this.props.skillTags],
      assignedConversationIds: [...this.props.assignedConversationIds],
      ...patch,
    });
  }

  goOnline(at: Date): ChatAgent {
    if (this.props.status === 'online') throw new Error('agent is already online');
    return this.clone({ status: 'online', updatedAt: at });
  }

  goOffline(at: Date): ChatAgent {
    if (this.props.status === 'offline') throw new Error('agent is already offline');
    return this.clone({ status: 'offline', updatedAt: at });
  }

  setBusy(at: Date): ChatAgent {
    if (this.props.status === 'offline') throw new Error('offline agents cannot set busy status');
    if (this.props.status === 'busy')    throw new Error('agent is already busy');
    return this.clone({ status: 'busy', updatedAt: at });
  }

  setAway(at: Date): ChatAgent {
    if (this.props.status === 'offline') throw new Error('offline agents cannot set away status');
    if (this.props.status === 'away')    throw new Error('agent is already away');
    return this.clone({ status: 'away', updatedAt: at });
  }

  assignConversation(conversationId: string, at: Date): ChatAgent {
    if (!conversationId) throw new Error('conversationId is required');
    if (this.props.status === 'offline')
      throw new Error('cannot assign conversations to offline agents');
    if (this.isAtCapacity())
      throw new Error('agent is at maximum concurrent chat capacity');
    if (this.props.assignedConversationIds.includes(conversationId))
      throw new Error('conversation is already assigned to this agent');
    return this.clone({
      assignedConversationIds: [...this.props.assignedConversationIds, conversationId],
      updatedAt: at,
    });
  }

  unassignConversation(conversationId: string, at: Date): ChatAgent {
    if (!this.props.assignedConversationIds.includes(conversationId))
      throw new Error('conversation is not assigned to this agent');
    return this.clone({
      assignedConversationIds: this.props.assignedConversationIds.filter(id => id !== conversationId),
      updatedAt: at,
    });
  }

  addSkill(skill: string, at: Date): ChatAgent {
    if (!skill) throw new Error('skill is required');
    if (this.props.skillTags.includes(skill)) throw new Error(`skill "${skill}" already exists`);
    return this.clone({ skillTags: [...this.props.skillTags, skill], updatedAt: at });
  }

  removeSkill(skill: string, at: Date): ChatAgent {
    if (!this.props.skillTags.includes(skill)) throw new Error(`skill "${skill}" not found`);
    return this.clone({
      skillTags: this.props.skillTags.filter(s => s !== skill), updatedAt: at,
    });
  }
}
