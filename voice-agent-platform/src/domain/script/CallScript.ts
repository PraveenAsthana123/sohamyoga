export type ClinicServiceType = 'dental' | 'chiropractic' | 'physiotherapy' | 'ent' | 'massage_therapy' | 'yoga';
// Single source of truth for every service-type dropdown/validator in the
// app -- multiple independent hardcoded copies of this list previously
// drifted out of sync when 'yoga' was added (found live 2026-09-02: one
// copy silently rejected 'yoga' while four others accepted it). Import
// this everywhere instead of re-typing the literal list.
export const CLINIC_SERVICE_TYPES: ClinicServiceType[] = ['dental', 'chiropractic', 'physiotherapy', 'ent', 'massage_therapy', 'yoga'];
export type CallScriptDirection = 'inbound' | 'outbound';

export interface CallScriptProps {
  id: string;
  slug: string;
  name: string;
  serviceType: ClinicServiceType;
  direction: CallScriptDirection;
  scenarioKey: string | null;
  category: string | null;
  ownerCustomerId: string | null;
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
  get direction() { return this.props.direction; }
  get scenarioKey() { return this.props.scenarioKey; }
  get category() { return this.props.category; }
  get ownerCustomerId() { return this.props.ownerCustomerId; }
  get publishedVersionId() { return this.props.publishedVersionId; }

  withPublishedVersion(versionId: string): CallScript {
    return new CallScript({ ...this.props, publishedVersionId: versionId, updatedAt: new Date() });
  }

  toJSON(): CallScriptProps {
    return { ...this.props };
  }
}
