// Identity MCP adapter — wraps Keycloak identity operations.
// The AI never receives passwords, OTP codes, social tokens, or raw session tokens.

export type IdentityMcpTier =
  | 'auto'              // no human approval needed
  | 'staff'             // requires staff role
  | 'customer_confirm'  // customer must confirm on their device
  | 'admin'             // admin approval required
  | 'admin_destructive';// admin approval + irreversible warning

export interface IdentityMcpTool {
  name:        string;
  description: string;
  tier:        IdentityMcpTier;
  riskLevel:   1 | 2 | 3 | 4 | 5;
  inputSchema: Record<string, unknown>;
  safetyNote?: string;
}

export const IDENTITY_MCP_TOOLS: IdentityMcpTool[] = [
  {
    name:        'find_user',
    description: 'Locate a Keycloak account by email or username. Returns masked identity summary — no credentials.',
    tier:        'staff',
    riskLevel:   2,
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Email or username to search' },
      },
    },
    safetyNote: 'Never return passwords, tokens, or raw session data',
  },
  {
    name:        'get_account_status',
    description: 'Check whether a user account is verified, active, or locked.',
    tier:        'staff',
    riskLevel:   1,
    inputSchema: {
      type: 'object',
      required: ['userId'],
      properties: {
        userId: { type: 'string' },
      },
    },
  },
  {
    name:        'send_verification',
    description: 'Resend email or SMS verification to the customer. Rate-limited to 3 per hour.',
    tier:        'customer_confirm',
    riskLevel:   1,
    inputSchema: {
      type: 'object',
      required: ['userId', 'channel'],
      properties: {
        userId:  { type: 'string' },
        channel: { type: 'string', enum: ['email', 'sms'] },
      },
    },
    safetyNote: 'Rate-limited: max 3 resends per userId per hour',
  },
  {
    name:        'send_password_reset',
    description: 'Initiate a password reset flow. Customer receives a one-time link — AI never sees the link.',
    tier:        'customer_confirm',
    riskLevel:   2,
    inputSchema: {
      type: 'object',
      required: ['userId'],
      properties: {
        userId: { type: 'string' },
      },
    },
    safetyNote: 'AI never receives or logs the reset token or link',
  },
  {
    name:        'list_user_roles',
    description: 'Retrieve the portal roles assigned to a user.',
    tier:        'staff',
    riskLevel:   1,
    inputSchema: {
      type: 'object',
      required: ['userId'],
      properties: {
        userId: { type: 'string' },
      },
    },
  },
  {
    name:        'request_role_assignment',
    description: 'Request a new portal role for a user. Requires administrator approval before taking effect.',
    tier:        'admin',
    riskLevel:   3,
    inputSchema: {
      type: 'object',
      required: ['userId', 'role', 'reason'],
      properties: {
        userId: { type: 'string' },
        role:   { type: 'string', enum: ['customer', 'teacher', 'reception', 'marketing', 'finance', 'portal_admin'] },
        reason: { type: 'string', description: 'Business justification' },
      },
    },
  },
  {
    name:        'disable_account_request',
    description: 'Request account suspension. Requires admin approval. Customer loses all portal access.',
    tier:        'admin_destructive',
    riskLevel:   5,
    inputSchema: {
      type: 'object',
      required: ['userId', 'reason'],
      properties: {
        userId: { type: 'string' },
        reason: { type: 'string' },
      },
    },
    safetyNote: 'Approval required. Suspends all sessions and portal access.',
  },
  {
    name:        'get_login_audit',
    description: 'Retrieve recent login events for an account. Available to security-role staff only.',
    tier:        'staff',
    riskLevel:   2,
    inputSchema: {
      type: 'object',
      required: ['userId'],
      properties: {
        userId: { type: 'string' },
        limit:  { type: 'number', minimum: 1, maximum: 50, default: 10 },
      },
    },
    safetyNote: 'Never expose IP addresses or user-agent strings to non-security roles',
  },
  {
    name:        'create_qr_login_challenge',
    description: 'Create a short-lived (60s) QR challenge for kiosk/TV login. Encodes only a random token — no credentials.',
    tier:        'auto',
    riskLevel:   2,
    inputSchema: {
      type: 'object',
      required: ['browserSessionId', 'deviceHint'],
      properties: {
        browserSessionId: { type: 'string' },
        deviceHint:       { type: 'string', description: 'Device identifier shown to approving user' },
        ttlSeconds:       { type: 'number', minimum: 30, maximum: 90, default: 60 },
      },
    },
    safetyNote: 'Challenge token expires after ttlSeconds. One-time use only.',
  },
  {
    name:        'confirm_qr_login',
    description: 'Complete a QR login after the customer approves on their authenticated mobile device.',
    tier:        'customer_confirm',
    riskLevel:   2,
    inputSchema: {
      type: 'object',
      required: ['challengeId', 'mobileSessionId'],
      properties: {
        challengeId:     { type: 'string' },
        mobileSessionId: { type: 'string', description: 'Authenticated mobile session confirming the login' },
      },
    },
    safetyNote: 'Challenge must not be expired or already used',
  },
];

export const IDENTITY_MCP_TOOL_COUNT = IDENTITY_MCP_TOOLS.length; // 10

export function getIdentityMcpTool(name: string): IdentityMcpTool | undefined {
  return IDENTITY_MCP_TOOLS.find((t) => t.name === name);
}

export function getIdentityMcpToolsByTier(tier: IdentityMcpTier): IdentityMcpTool[] {
  return IDENTITY_MCP_TOOLS.filter((t) => t.tier === tier);
}
