export type CallScriptVersionStatus = 'draft' | 'published' | 'archived';

export interface CallScriptSections {
  opening: string;
  discoveryQuestions: string[];
  objectionHandling: string;
  closing: string;
}

export interface CallScriptVersionProps {
  id: string;
  scriptId: string;
  versionNumber: number;
  sections: CallScriptSections;
  status: CallScriptVersionStatus;
  createdBy: string;
  createdAt: Date;
}

export class CallScriptVersion {
  private readonly props: CallScriptVersionProps;

  constructor(props: CallScriptVersionProps) {
    if (props.versionNumber < 1) throw new Error('versionNumber must be >= 1');
    if (!props.sections.opening?.trim()) throw new Error('opening section is required');
    if (!props.sections.closing?.trim()) throw new Error('closing section is required');
    if (!Array.isArray(props.sections.discoveryQuestions)) throw new Error('discoveryQuestions must be an array');
    this.props = { ...props, sections: { ...props.sections, discoveryQuestions: [...props.sections.discoveryQuestions] } };
  }

  get id() { return this.props.id; }
  get scriptId() { return this.props.scriptId; }
  get versionNumber() { return this.props.versionNumber; }
  get sections() { return { ...this.props.sections, discoveryQuestions: [...this.props.sections.discoveryQuestions] }; }
  get status() { return this.props.status; }

  publish(): CallScriptVersion {
    if (this.props.status !== 'draft') throw new Error('only a draft version can be published');
    return new CallScriptVersion({ ...this.props, status: 'published' });
  }

  archive(): CallScriptVersion {
    if (this.props.status !== 'published') throw new Error('only a published version can be archived');
    return new CallScriptVersion({ ...this.props, status: 'archived' });
  }

  toJSON(): CallScriptVersionProps {
    return { ...this.props, sections: this.sections };
  }
}
