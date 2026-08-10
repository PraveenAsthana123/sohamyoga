// Check-in MCP adapter — AI access to QR/barcode attendance operations.
// Never grants direct database access; all validation logic runs server-side.

export type CheckinMcpTier = 'auto' | 'staff' | 'supervisor';

export interface CheckinMcpTool {
  name:        string;
  description: string;
  tier:        CheckinMcpTier;
  riskLevel:   1 | 2 | 3 | 4;
  inputSchema: Record<string, unknown>;
  safetyNote?: string;
}

export const CHECKIN_MCP_TOOLS: CheckinMcpTool[] = [
  {
    name:        'find_registration',
    description: 'Locate a registration by QR token value or booking reference number.',
    tier:        'staff',
    riskLevel:   1,
    inputSchema: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string', description: 'tk_<hex> token from QR scan or booking ref' },
      },
    },
    safetyNote: 'Returns registration summary only — no payment or health data',
  },
  {
    name:        'validate_checkin',
    description: 'Validate a token against booking rules: membership active, class date correct, capacity available.',
    tier:        'auto',
    riskLevel:   1,
    inputSchema: {
      type: 'object',
      required: ['token', 'classId'],
      properties: {
        token:   { type: 'string' },
        classId: { type: 'string' },
        nowIso:  { type: 'string', format: 'date-time', description: 'Current time for validation' },
      },
    },
  },
  {
    name:        'record_checkin',
    description: 'Record a successful check-in. Decrements package credits where applicable.',
    tier:        'staff',
    riskLevel:   2,
    inputSchema: {
      type: 'object',
      required: ['token', 'classId', 'staffId', 'deviceId'],
      properties: {
        token:   { type: 'string' },
        classId: { type: 'string' },
        staffId: { type: 'string' },
        deviceId: { type: 'string' },
        note:    { type: 'string' },
      },
    },
  },
  {
    name:        'get_attendance_status',
    description: 'Check whether a customer has already checked into a specific class.',
    tier:        'staff',
    riskLevel:   1,
    inputSchema: {
      type: 'object',
      required: ['customerId', 'classId'],
      properties: {
        customerId: { type: 'string' },
        classId:    { type: 'string' },
      },
    },
  },
  {
    name:        'reverse_checkin',
    description: 'Correct an accidental check-in. Restores any decremented package credits.',
    tier:        'supervisor',
    riskLevel:   3,
    inputSchema: {
      type: 'object',
      required: ['checkinId', 'supervisorId', 'reason'],
      properties: {
        checkinId:    { type: 'string' },
        supervisorId: { type: 'string' },
        reason:       { type: 'string' },
      },
    },
    safetyNote: 'Supervisor approval required. Action is audited.',
  },
  {
    name:        'issue_replacement_code',
    description: 'Revoke the current token and issue a fresh QR for a registration.',
    tier:        'staff',
    riskLevel:   3,
    inputSchema: {
      type: 'object',
      required: ['registrationId', 'staffId', 'reason'],
      properties: {
        registrationId: { type: 'string' },
        staffId:        { type: 'string' },
        reason:         { type: 'string', description: 'e.g. lost phone, damaged barcode' },
      },
    },
    safetyNote: 'Old token is immediately revoked on issuance of the new one',
  },
  {
    name:        'get_class_checkin_summary',
    description: 'Return registered, arrived, and absent totals for a class. Visible to teacher and staff.',
    tier:        'staff',
    riskLevel:   1,
    inputSchema: {
      type: 'object',
      required: ['classId'],
      properties: {
        classId: { type: 'string' },
      },
    },
  },
  {
    name:        'flag_suspicious_scan',
    description: 'Record a suspicious scan event (repeated scan, wrong device, unknown token).',
    tier:        'auto',
    riskLevel:   2,
    inputSchema: {
      type: 'object',
      required: ['token', 'deviceId', 'reason'],
      properties: {
        token:    { type: 'string' },
        deviceId: { type: 'string' },
        reason:   { type: 'string', enum: ['repeated_scan', 'wrong_class', 'unknown_token', 'wrong_device'] },
        ipAddress: { type: 'string' },
      },
    },
    safetyNote: 'Event is stored in audit log only — does not block entry automatically',
  },
];

export const CHECKIN_MCP_TOOL_COUNT = CHECKIN_MCP_TOOLS.length; // 8

export function getCheckinMcpTool(name: string): CheckinMcpTool | undefined {
  return CHECKIN_MCP_TOOLS.find((t) => t.name === name);
}
