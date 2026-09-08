export type CallScriptVersionStatus = 'draft' | 'published' | 'archived';

export interface CallScriptSections {
  opening: string;
  discoveryQuestions: string[];
  objectionHandling: string;
  closing: string;
}

// Real, controllable Vapi assistant config -- every field here is a
// verified-live Vapi Assistant API field (confirmed against the real API
// 2026-09-02), not a guess. Defaults match Vapi's own commonly-used
// defaults; all are editable per script version.
export interface VapiAdvancedConfig {
  modelProvider: string;
  model: string;
  voiceProvider: string;
  voiceId: string;
  transcriberProvider: string;
  transcriberModel: string;
  transcriberLanguage: string;
  endCallMessage: string;
  silenceTimeoutSeconds: number;
  maxDurationSeconds: number;
}

export const DEFAULT_VAPI_CONFIG: VapiAdvancedConfig = {
  modelProvider: 'openai', model: 'gpt-4o',
  voiceProvider: '11labs', voiceId: 'burt',
  transcriberProvider: 'deepgram', transcriberModel: 'nova-2', transcriberLanguage: 'en',
  endCallMessage: 'Thank you, goodbye.',
  silenceTimeoutSeconds: 30, maxDurationSeconds: 600,
};

export interface CallScriptVersionProps {
  id: string;
  scriptId: string;
  versionNumber: number;
  sections: CallScriptSections;
  status: CallScriptVersionStatus;
  createdBy: string;
  createdAt: Date;
  vapiAssistantId?: string | null;
  vapiSyncedAt?: Date | null;
  vapiSyncError?: string | null;
  vapiConfig?: VapiAdvancedConfig;
}

export class CallScriptVersion {
  private readonly props: CallScriptVersionProps;

  constructor(props: CallScriptVersionProps) {
    if (props.versionNumber < 1) throw new Error('versionNumber must be >= 1');
    if (!props.sections.opening?.trim()) throw new Error('opening section is required');
    if (!props.sections.closing?.trim()) throw new Error('closing section is required');
    if (!Array.isArray(props.sections.discoveryQuestions)) throw new Error('discoveryQuestions must be an array');
    const vapiConfig = props.vapiConfig ?? DEFAULT_VAPI_CONFIG;
    if (vapiConfig.silenceTimeoutSeconds <= 0) throw new Error('silenceTimeoutSeconds must be > 0');
    if (vapiConfig.maxDurationSeconds <= 0) throw new Error('maxDurationSeconds must be > 0');
    this.props = { ...props, vapiConfig, sections: { ...props.sections, discoveryQuestions: [...props.sections.discoveryQuestions] } };
  }

  get id() { return this.props.id; }
  get scriptId() { return this.props.scriptId; }
  get versionNumber() { return this.props.versionNumber; }
  get sections() { return { ...this.props.sections, discoveryQuestions: [...this.props.sections.discoveryQuestions] }; }
  get status() { return this.props.status; }
  get vapiAssistantId() { return this.props.vapiAssistantId ?? null; }
  get vapiSyncedAt() { return this.props.vapiSyncedAt ?? null; }
  get vapiSyncError() { return this.props.vapiSyncError ?? null; }
  get vapiConfig() { return { ...(this.props.vapiConfig ?? DEFAULT_VAPI_CONFIG) }; }

  publish(): CallScriptVersion {
    if (this.props.status !== 'draft') throw new Error('only a draft version can be published');
    return new CallScriptVersion({ ...this.props, status: 'published' });
  }

  archive(): CallScriptVersion {
    if (this.props.status !== 'published') throw new Error('only a published version can be archived');
    return new CallScriptVersion({ ...this.props, status: 'archived' });
  }

  withVapiConfig(config: VapiAdvancedConfig): CallScriptVersion {
    return new CallScriptVersion({ ...this.props, vapiConfig: config });
  }

  toJSON(): CallScriptVersionProps {
    return { ...this.props, sections: this.sections, vapiConfig: this.vapiConfig };
  }
}
