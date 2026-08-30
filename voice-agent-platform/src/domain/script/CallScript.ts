export type ClinicServiceType = 'dental' | 'chiropractic' | 'physiotherapy' | 'ent' | 'massage_therapy';

export interface CallScriptProps {
  id: string;
  slug: string;
  name: string;
  serviceType: ClinicServiceType;
  publishedVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CallScript {
  private readonly props: CallScriptProps;

  constructor(props: CallScriptProps) {
    if (!/^[a-z0-9-]+$/.test(props.slug)) throw new Error('slug must be lowercase letters, numbers, and hyphens');
    if (!props.name.trim()) throw new Error('name is required');
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get slug() { return this.props.slug; }
  get name() { return this.props.name; }
  get serviceType() { return this.props.serviceType; }
  get publishedVersionId() { return this.props.publishedVersionId; }

  withPublishedVersion(versionId: string): CallScript {
    return new CallScript({ ...this.props, publishedVersionId: versionId, updatedAt: new Date() });
  }

  toJSON(): CallScriptProps {
    return { ...this.props };
  }
}
