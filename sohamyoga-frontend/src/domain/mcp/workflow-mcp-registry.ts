import { McpServerManifest, McpTool } from './types';

const TOOLS: McpTool[] = [
  {
    name: 'list_workflows',
    description: 'List available workflow definitions and currently running workflow instances.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object',
      properties: {
        status:   { type: 'string', enum: ['running','completed','failed','pending_approval','all'], default: 'all' },
        category: { type: 'string', enum: ['booking','payment','onboarding','marketing','hr','all'], default: 'all' },
        limit:    { type: 'number', default: 20 },
      },
    },
  },
  {
    name: 'start_workflow',
    description: 'Trigger a predefined Activepieces or Temporal workflow with the supplied input payload.',
    tier: 'staff', riskLevel: 3,
    inputSchema: { type: 'object', required: ['workflowId', 'triggeredBy'],
      properties: {
        workflowId:   { type: 'string' },
        triggeredBy:  { type: 'string' },
        inputPayload: { type: 'object', description: 'Workflow-specific input parameters' },
        idempotencyKey: { type: 'string', description: 'Prevents duplicate triggers' },
      },
    },
    safetyNote: 'Verify the workflow is idempotent or provide an idempotencyKey to prevent duplicate side effects',
  },
  {
    name: 'get_workflow_status',
    description: 'Return the current state, step completion, and output of a running or completed workflow.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['workflowRunId'],
      properties: { workflowRunId: { type: 'string' } },
    },
  },
  {
    name: 'approve_workflow_step',
    description: 'Approve a workflow step that is waiting for human sign-off (e.g. bulk-email or refund approval).',
    tier: 'admin', riskLevel: 4,
    inputSchema: { type: 'object', required: ['workflowRunId', 'stepId', 'approvedBy'],
      properties: {
        workflowRunId: { type: 'string' },
        stepId:        { type: 'string' },
        approvedBy:    { type: 'string' },
        notes:         { type: 'string' },
      },
    },
    safetyNote: 'Approve only after reviewing the workflow step output. Approval may trigger financial or public-facing actions.',
    tags: ['requires_approval'],
  },
  {
    name: 'retry_workflow_step',
    description: 'Retry a failed workflow step, optionally with a corrected input payload.',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['workflowRunId', 'stepId'],
      properties: {
        workflowRunId:  { type: 'string' },
        stepId:         { type: 'string' },
        updatedPayload: { type: 'object' },
      },
    },
    safetyNote: 'Do not retry a step if it involves sending money or publishing to external channels without re-validating the trigger conditions',
  },
  {
    name: 'cancel_workflow',
    description: 'Cancel a running workflow. Admin approval required if the workflow has partially applied side effects.',
    tier: 'admin', riskLevel: 4,
    inputSchema: { type: 'object', required: ['workflowRunId', 'cancelledBy', 'reason'],
      properties: {
        workflowRunId: { type: 'string' },
        cancelledBy:   { type: 'string' },
        reason:        { type: 'string' },
      },
    },
    safetyNote: 'Cancellation does not automatically roll back already-applied steps. Review compensating actions.',
    tags: ['requires_approval'],
  },
  {
    name: 'get_workflow_history',
    description: 'Retrieve the execution history and step log for a workflow run.',
    tier: 'staff', riskLevel: 1,
    inputSchema: { type: 'object', required: ['workflowRunId'],
      properties: {
        workflowRunId: { type: 'string' },
        includePayloads: { type: 'boolean', default: false, description: 'Include step input/output payloads — sensitive' },
      },
    },
    safetyNote: 'Do not include payloads in non-admin contexts — they may contain PII or financial data',
  },
];

export const WORKFLOW_MCP: McpServerManifest = {
  id:          'workflow-mcp',
  slug:        'workflow-mcp',
  name:        'Workflow MCP',
  description: 'Trigger, monitor, approve, retry, and cancel automated workflows across Activepieces and Temporal.',
  version:     '1.0.0',
  tools:       TOOLS,
  backingServices: ['Activepieces', 'Temporal', 'Novu (notification steps)'],
  availability: 'custom',
  implementationNote: 'Temporal has community MCP adapters — evaluate. Build custom Activepieces MCP wrapping the Activepieces REST API with approval-gated execution.',
};
