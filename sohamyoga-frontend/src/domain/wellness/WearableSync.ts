// Wave 17: Health & Wellness — Wearable Device Sync entity

export type WearablePlatform =
  | 'fitbit' | 'garmin' | 'apple_health' | 'google_fit' | 'samsung_health' | 'polar';

export type SyncStatus = 'connected' | 'disconnected' | 'syncing' | 'error' | 'pending_auth';

export interface WearableDataPoint {
  metric:     string;   // 'steps', 'heart_rate', 'sleep_minutes', 'calories_burned', 'stress_score'
  value:      number;
  unit:       string;   // 'count', 'bpm', 'minutes', 'kcal', 'score'
  recordedAt: Date;
}

export interface WearableSyncProps {
  id:              string;
  customerId:      string;
  platform:        WearablePlatform;
  status:          SyncStatus;
  deviceName?:     string;
  lastSyncAt?:     Date;
  nextSyncAt?:     Date;
  dataPoints:      WearableDataPoint[];
  errorMessage?:   string;
  connectedAt?:    Date;
  disconnectedAt?: Date;
  createdAt:       Date;
  updatedAt:       Date;
}

export class WearableSync {
  private readonly props: Readonly<WearableSyncProps>;

  constructor(props: WearableSyncProps) {
    if (!props.id?.trim())         throw new Error('id is required');
    if (!props.customerId?.trim()) throw new Error('customerId is required');
    if (props.status === 'connected' && !props.connectedAt)
      throw new Error('connected status requires connectedAt');
    if (props.status === 'error' && !props.errorMessage?.trim())
      throw new Error('error status requires errorMessage');
    if (props.disconnectedAt && !props.connectedAt)
      throw new Error('disconnectedAt requires connectedAt');
    if (props.lastSyncAt && props.nextSyncAt && props.nextSyncAt <= props.lastSyncAt)
      throw new Error('nextSyncAt must be after lastSyncAt');

    this.props = {
      ...props,
      dataPoints: props.dataPoints.map(dp => ({ ...dp })),
    };
  }

  get id()             { return this.props.id; }
  get customerId()     { return this.props.customerId; }
  get platform()       { return this.props.platform; }
  get status()         { return this.props.status; }
  get deviceName()     { return this.props.deviceName; }
  get lastSyncAt()     { return this.props.lastSyncAt; }
  get nextSyncAt()     { return this.props.nextSyncAt; }
  get dataPoints()     { return this.props.dataPoints.map(dp => ({ ...dp })); }
  get errorMessage()   { return this.props.errorMessage; }
  get connectedAt()    { return this.props.connectedAt; }
  get disconnectedAt() { return this.props.disconnectedAt; }
  get createdAt()      { return this.props.createdAt; }
  get updatedAt()      { return this.props.updatedAt; }

  isConnected()    { return this.props.status === 'connected';    }
  isSyncing()      { return this.props.status === 'syncing';      }
  isError()        { return this.props.status === 'error';        }
  isDisconnected() { return this.props.status === 'disconnected'; }
  isPendingAuth()  { return this.props.status === 'pending_auth'; }

  private clone(patch: Partial<WearableSyncProps>): WearableSync {
    return new WearableSync({ ...this.props, ...patch });
  }

  connect(deviceName: string, now: Date): WearableSync {
    if (!deviceName?.trim()) throw new Error('deviceName cannot be empty');
    return this.clone({
      status:          'connected',
      deviceName:      deviceName.trim(),
      connectedAt:     now,
      disconnectedAt:  undefined,
      errorMessage:    undefined,
      updatedAt:       now,
    });
  }

  disconnect(now: Date): WearableSync {
    if (this.props.status !== 'connected')
      throw new Error('can only disconnect a connected device');
    return this.clone({ status: 'disconnected', disconnectedAt: now, updatedAt: now });
  }

  startSync(now: Date): WearableSync {
    if (this.props.status !== 'connected')
      throw new Error('can only start sync for a connected device');
    return this.clone({ status: 'syncing', updatedAt: now });
  }

  completeSync(newPoints: WearableDataPoint[], now: Date): WearableSync {
    if (this.props.status !== 'syncing')
      throw new Error('can only complete sync when syncing');
    return this.clone({
      status:       'connected',
      lastSyncAt:   now,
      dataPoints:   [...this.props.dataPoints, ...newPoints.map(dp => ({ ...dp }))],
      errorMessage: undefined,
      updatedAt:    now,
    });
  }

  failSync(errorMessage: string, now: Date): WearableSync {
    if (!errorMessage?.trim()) throw new Error('errorMessage cannot be empty');
    if (this.props.status !== 'syncing')
      throw new Error('can only fail sync when syncing');
    return this.clone({ status: 'error', errorMessage: errorMessage.trim(), updatedAt: now });
  }

  clearError(now: Date): WearableSync {
    if (this.props.status !== 'error')
      throw new Error('can only clear error when in error status');
    return this.clone({ status: 'connected', errorMessage: undefined, updatedAt: now });
  }

  addDataPoint(point: WearableDataPoint): WearableSync {
    return this.clone({ dataPoints: [...this.props.dataPoints, { ...point }] });
  }

  latestDataPoint(metric: string): WearableDataPoint | undefined {
    const matches = this.props.dataPoints.filter(dp => dp.metric === metric);
    if (matches.length === 0) return undefined;
    return { ...matches.reduce((latest, dp) =>
      dp.recordedAt > latest.recordedAt ? dp : latest
    ) };
  }
}
