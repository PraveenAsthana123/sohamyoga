export type DiscoveryRunType = 'manual_import' | 'scheduled_scan';
export type DiscoveryRunStatus = 'running' | 'succeeded' | 'failed';

interface DiscoveryRunProps {
  id: string;
  tenantId: string;
  connectorId: string;
  sourceId?: string;
  runType: DiscoveryRunType;
  status: DiscoveryRunStatus;
  sourcesDiscovered: number;
  sourcesNew: number;
  sourcesChanged: number;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export class DiscoveryRun {
  private readonly props: DiscoveryRunProps;

  constructor(props: DiscoveryRunProps) {
    if (!props.id) throw new Error('id is required');
    if (!props.connectorId) throw new Error('connectorId is required');
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get sourceId() { return this.props.sourceId; }
}
