export type McpCallStatus =
  | 'success'
  | 'failed'
  | 'timeout'
  | 'pending_approval'
  | 'approved'
  | 'rejected';

export type McpTier =
  | 'auto'
  | 'staff'
  | 'customer_confirm'
  | 'staff_approval'
  | 'admin'
  | 'admin_destructive';

const TERMINAL_STATUSES: McpCallStatus[] = ['success', 'failed', 'timeout', 'rejected'];

export interface McpToolCallProps {
  id: string;
  tenantId: string;
  serverId: string;
  toolName: string;
  tier: McpTier;
  status: McpCallStatus;
  actorId: string;
  actorRole: string;
  durationMs?: number;
  errorMessage?: string;
  approvalId?: string;
  rejectionReason?: string;
  flaggedForReview: boolean;
  promptInjectionSuspected: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

export class McpToolCall {
  private readonly props: Readonly<McpToolCallProps>;

  constructor(props: McpToolCallProps) {
    if (!props.id.trim())        throw new Error('id is required');
    if (!props.tenantId.trim())  throw new Error('tenantId is required');
    if (!props.serverId.trim())  throw new Error('serverId is required');
    if (!props.toolName.trim())  throw new Error('toolName is required');
    if (!props.actorId.trim())   throw new Error('actorId is required');
    if (!props.actorRole.trim()) throw new Error('actorRole is required');
    if (props.durationMs !== undefined && props.durationMs < 0)
      throw new Error('durationMs must be non-negative');
    if (props.status === 'approved' && !props.approvalId)
      throw new Error('approved call requires approvalId');
    if (props.status === 'rejected' && !props.rejectionReason)
      throw new Error('rejected call requires rejectionReason');

    this.props = { ...props };
  }

  private clone(patch: Partial<McpToolCallProps>): McpToolCall {
    return new McpToolCall({ ...this.props, ...patch });
  }

  get id():                     string           { return this.props.id; }
  get tenantId():               string           { return this.props.tenantId; }
  get serverId():               string           { return this.props.serverId; }
  get toolName():               string           { return this.props.toolName; }
  get tier():                   McpTier          { return this.props.tier; }
  get status():                 McpCallStatus    { return this.props.status; }
  get actorId():                string           { return this.props.actorId; }
  get actorRole():              string           { return this.props.actorRole; }
  get durationMs():             number|undefined { return this.props.durationMs; }
  get errorMessage():           string|undefined { return this.props.errorMessage; }
  get approvalId():             string|undefined { return this.props.approvalId; }
  get rejectionReason():        string|undefined { return this.props.rejectionReason; }
  get flaggedForReview():       boolean          { return this.props.flaggedForReview; }
  get promptInjectionSuspected(): boolean        { return this.props.promptInjectionSuspected; }
  get createdAt():              Date             { return this.props.createdAt; }
  get resolvedAt():             Date|undefined   { return this.props.resolvedAt; }

  isTerminal():         boolean { return TERMINAL_STATUSES.includes(this.props.status); }
  isPendingApproval():  boolean { return this.props.status === 'pending_approval'; }
  isApproved():         boolean { return this.props.status === 'approved'; }
  isSuccessful():       boolean { return this.props.status === 'success'; }
  isSuspicious():       boolean { return this.props.flaggedForReview || this.props.promptInjectionSuspected; }

  requiresApproval(): boolean {
    return this.props.tier === 'staff_approval' || this.props.tier === 'admin_destructive';
  }

  markSuccess(durationMs: number, now: Date): McpToolCall {
    if (this.isTerminal()) throw new Error('call is already in a terminal state');
    if (durationMs < 0)    throw new Error('durationMs must be non-negative');
    return this.clone({ status: 'success', durationMs, resolvedAt: now });
  }

  markFailed(errorMessage: string, durationMs: number, now: Date): McpToolCall {
    if (this.isTerminal()) throw new Error('call is already in a terminal state');
    if (!errorMessage.trim()) throw new Error('errorMessage is required');
    if (durationMs < 0)       throw new Error('durationMs must be non-negative');
    return this.clone({ status: 'failed', errorMessage, durationMs, resolvedAt: now });
  }

  markTimeout(durationMs: number, now: Date): McpToolCall {
    if (this.isTerminal()) throw new Error('call is already in a terminal state');
    return this.clone({ status: 'timeout', durationMs, resolvedAt: now });
  }

  approve(approvalId: string, now: Date): McpToolCall {
    if (this.props.status !== 'pending_approval')
      throw new Error('can only approve a pending_approval call');
    if (!approvalId.trim()) throw new Error('approvalId is required');
    return this.clone({ status: 'approved', approvalId, resolvedAt: now });
  }

  reject(reason: string, now: Date): McpToolCall {
    if (this.props.status !== 'pending_approval')
      throw new Error('can only reject a pending_approval call');
    if (!reason.trim()) throw new Error('rejectionReason is required');
    return this.clone({ status: 'rejected', rejectionReason: reason, resolvedAt: now });
  }

  flagForReview(): McpToolCall {
    if (this.props.flaggedForReview) throw new Error('call is already flagged');
    return this.clone({ flaggedForReview: true });
  }

  suspectPromptInjection(): McpToolCall {
    return this.clone({ promptInjectionSuspected: true, flaggedForReview: true });
  }
}
