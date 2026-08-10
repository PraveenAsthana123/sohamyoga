export type McpServerStatus = 'online' | 'offline' | 'degraded' | 'maintenance';

export interface McpServerProps {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  version: string;
  endpoint: string;
  status: McpServerStatus;
  toolCount: number;
  description: string;
  isEnabled: boolean;
  lastCheckedAt?: Date;
  maintenanceNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class McpServer {
  private readonly props: Readonly<McpServerProps>;

  constructor(props: McpServerProps) {
    if (!props.id.trim())       throw new Error('id is required');
    if (!props.tenantId.trim()) throw new Error('tenantId is required');
    if (!props.name.trim())     throw new Error('name is required');
    if (!props.slug.trim())     throw new Error('slug is required');
    if (!/^[a-z0-9-]+$/.test(props.slug))
      throw new Error('slug must be lowercase alphanumeric with hyphens');
    if (!props.version.trim())  throw new Error('version is required');
    if (!props.endpoint.trim()) throw new Error('endpoint is required');
    if (!Number.isInteger(props.toolCount) || props.toolCount < 0)
      throw new Error('toolCount must be a non-negative integer');
    if (props.status === 'maintenance' && !props.maintenanceNote)
      throw new Error('maintenanceNote is required when status is maintenance');

    this.props = { ...props };
  }

  private clone(patch: Partial<McpServerProps>): McpServer {
    return new McpServer({ ...this.props, ...patch });
  }

  get id():               string               { return this.props.id; }
  get tenantId():         string               { return this.props.tenantId; }
  get name():             string               { return this.props.name; }
  get slug():             string               { return this.props.slug; }
  get version():          string               { return this.props.version; }
  get endpoint():         string               { return this.props.endpoint; }
  get status():           McpServerStatus      { return this.props.status; }
  get toolCount():        number               { return this.props.toolCount; }
  get description():      string               { return this.props.description; }
  get isEnabled():        boolean              { return this.props.isEnabled; }
  get lastCheckedAt():    Date|undefined       { return this.props.lastCheckedAt; }
  get maintenanceNote():  string|undefined     { return this.props.maintenanceNote; }
  get createdAt():        Date                 { return this.props.createdAt; }
  get updatedAt():        Date                 { return this.props.updatedAt; }

  isOnline():      boolean { return this.props.status === 'online'; }
  isOffline():     boolean { return this.props.status === 'offline'; }
  isDegraded():    boolean { return this.props.status === 'degraded'; }
  isInMaintenance(): boolean { return this.props.status === 'maintenance'; }
  isHealthy():     boolean { return this.props.status === 'online' && this.props.isEnabled; }

  markOnline(now: Date): McpServer {
    if (this.props.status === 'maintenance')
      throw new Error('end maintenance before marking online');
    return this.clone({ status: 'online', lastCheckedAt: now, updatedAt: now });
  }

  markOffline(now: Date): McpServer {
    return this.clone({ status: 'offline', lastCheckedAt: now, updatedAt: now });
  }

  markDegraded(now: Date): McpServer {
    if (this.props.status === 'offline')
      throw new Error('offline server cannot be marked degraded — bring online first');
    return this.clone({ status: 'degraded', lastCheckedAt: now, updatedAt: now });
  }

  startMaintenance(note: string, now: Date): McpServer {
    if (!note.trim()) throw new Error('maintenanceNote is required');
    if (this.props.status === 'maintenance')
      throw new Error('server is already in maintenance');
    return this.clone({ status: 'maintenance', maintenanceNote: note, updatedAt: now });
  }

  endMaintenance(now: Date): McpServer {
    if (this.props.status !== 'maintenance')
      throw new Error('server is not in maintenance');
    return this.clone({ status: 'online', maintenanceNote: undefined, lastCheckedAt: now, updatedAt: now });
  }

  enable(now: Date): McpServer {
    if (this.props.isEnabled) throw new Error('server is already enabled');
    return this.clone({ isEnabled: true, updatedAt: now });
  }

  disable(now: Date): McpServer {
    if (!this.props.isEnabled) throw new Error('server is already disabled');
    return this.clone({ isEnabled: false, updatedAt: now });
  }

  updateToolCount(count: number, now: Date): McpServer {
    if (!Number.isInteger(count) || count < 0)
      throw new Error('toolCount must be a non-negative integer');
    return this.clone({ toolCount: count, updatedAt: now });
  }

  recordCheck(now: Date): McpServer {
    return this.clone({ lastCheckedAt: now, updatedAt: now });
  }
}
