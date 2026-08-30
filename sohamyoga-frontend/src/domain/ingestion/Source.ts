export type SourceClassification = 'public' | 'internal' | 'confidential' | 'restricted' | 'highly_restricted';
export type SourceDiscoveryStatus = 'registered' | 'discovered' | 'active' | 'changed' | 'unavailable' | 'archived';

interface SourceProps {
  id: string;
  tenantId: string;
  connectorId: string;
  sourceType: string;
  externalId: string;
  name: string;
  parentSourceId?: string;
  classification: SourceClassification;
  discoveryStatus: SourceDiscoveryStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  modifiedAt: Date;
  lastDiscoveredAt?: Date;
  lastVerifiedAt?: Date;
}

export class Source {
  private readonly props: SourceProps;

  constructor(props: SourceProps) {
    if (!props.id) throw new Error('id is required');
    if (!props.externalId) throw new Error('externalId is required');
    if (!props.name?.trim()) throw new Error('name is required');
    this.props = { ...props, metadata: { ...props.metadata } };
  }

  get id() { return this.props.id; }
  get connectorId() { return this.props.connectorId; }
  get externalId() { return this.props.externalId; }
  get name() { return this.props.name; }
  get discoveryStatus() { return this.props.discoveryStatus; }
  get metadata() { return { ...this.props.metadata }; }
}
