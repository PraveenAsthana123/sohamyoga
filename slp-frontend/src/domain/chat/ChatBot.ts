export type BotType   = 'rule_based' | 'llm' | 'rag' | 'hybrid';
export type BotStatus = 'active' | 'inactive' | 'training';

interface ChatBotProps {
  id: string;
  name: string;
  botType: BotType;
  status: BotStatus;
  model?: string;
  systemPrompt: string;
  knowledgeBaseId?: string;
  handoffTriggers: string[];
  fallbackAgentId?: string;
  maxTurns: number;
  temperature: number;          // 0-1
  responseTimeoutMs: number;    // min 100
  confidenceThreshold: number;  // 0-1: confidence below this triggers handoff
  createdAt: Date;
  updatedAt: Date;
}

export class ChatBot {
  private readonly props: ChatBotProps;

  constructor(props: ChatBotProps) {
    if (!props.id)           throw new Error('id is required');
    if (!props.name)         throw new Error('name is required');
    if (!props.systemPrompt) throw new Error('systemPrompt is required');
    if (props.maxTurns < 1)  throw new Error('maxTurns must be at least 1');
    if (props.temperature < 0 || props.temperature > 1)
      throw new Error('temperature must be 0-1');
    if (props.confidenceThreshold < 0 || props.confidenceThreshold > 1)
      throw new Error('confidenceThreshold must be 0-1');
    if (props.responseTimeoutMs < 100)
      throw new Error('responseTimeoutMs must be at least 100');
    this.props = { ...props, handoffTriggers: [...props.handoffTriggers] };
  }

  get id()                  { return this.props.id; }
  get name()                { return this.props.name; }
  get botType()             { return this.props.botType; }
  get status()              { return this.props.status; }
  get model()               { return this.props.model; }
  get systemPrompt()        { return this.props.systemPrompt; }
  get knowledgeBaseId()     { return this.props.knowledgeBaseId; }
  get handoffTriggers()     { return [...this.props.handoffTriggers]; }
  get fallbackAgentId()     { return this.props.fallbackAgentId; }
  get maxTurns()            { return this.props.maxTurns; }
  get temperature()         { return this.props.temperature; }
  get responseTimeoutMs()   { return this.props.responseTimeoutMs; }
  get confidenceThreshold() { return this.props.confidenceThreshold; }
  get createdAt()           { return this.props.createdAt; }
  get updatedAt()           { return this.props.updatedAt; }

  isActive()   { return this.props.status === 'active'; }
  isTraining() { return this.props.status === 'training'; }
  shouldHandoff(confidence: number): boolean {
    return confidence < this.props.confidenceThreshold;
  }

  private clone(patch: Partial<ChatBotProps>): ChatBot {
    return new ChatBot({
      ...this.props,
      handoffTriggers: [...this.props.handoffTriggers],
      ...patch,
    });
  }

  activate(at: Date): ChatBot {
    if (this.props.status === 'active')   throw new Error('bot is already active');
    if (this.props.status === 'training') throw new Error('cannot activate a bot that is training');
    return this.clone({ status: 'active', updatedAt: at });
  }

  deactivate(at: Date): ChatBot {
    if (this.props.status === 'inactive') throw new Error('bot is already inactive');
    return this.clone({ status: 'inactive', updatedAt: at });
  }

  startTraining(at: Date): ChatBot {
    if (this.props.status === 'training') throw new Error('bot is already training');
    return this.clone({ status: 'training', updatedAt: at });
  }

  updatePrompt(systemPrompt: string, at: Date): ChatBot {
    if (!systemPrompt.trim()) throw new Error('systemPrompt cannot be empty');
    return this.clone({ systemPrompt, updatedAt: at });
  }

  setModel(model: string, at: Date): ChatBot {
    if (!model.trim()) throw new Error('model cannot be empty');
    return this.clone({ model, updatedAt: at });
  }

  setTemperature(temperature: number, at: Date): ChatBot {
    if (temperature < 0 || temperature > 1) throw new Error('temperature must be 0-1');
    return this.clone({ temperature, updatedAt: at });
  }

  setConfidenceThreshold(threshold: number, at: Date): ChatBot {
    if (threshold < 0 || threshold > 1) throw new Error('confidenceThreshold must be 0-1');
    return this.clone({ confidenceThreshold: threshold, updatedAt: at });
  }

  addHandoffTrigger(trigger: string, at: Date): ChatBot {
    if (!trigger.trim()) throw new Error('trigger cannot be empty');
    if (this.props.handoffTriggers.includes(trigger))
      throw new Error(`trigger "${trigger}" already exists`);
    return this.clone({
      handoffTriggers: [...this.props.handoffTriggers, trigger], updatedAt: at,
    });
  }

  removeHandoffTrigger(trigger: string, at: Date): ChatBot {
    if (!this.props.handoffTriggers.includes(trigger))
      throw new Error(`trigger "${trigger}" not found`);
    return this.clone({
      handoffTriggers: this.props.handoffTriggers.filter(t => t !== trigger), updatedAt: at,
    });
  }
}
