// Registration MCP adapter — social lead capture and onboarding.
// Covers Facebook/Instagram/LinkedIn lead forms and portal sign-up.

export type RegistrationMcpTier = 'auto' | 'rate_limited' | 'customer_confirm' | 'restricted';

export interface RegistrationMcpTool {
  name:        string;
  description: string;
  tier:        RegistrationMcpTier;
  riskLevel:   1 | 2 | 3;
  inputSchema: Record<string, unknown>;
  safetyNote?: string;
}

export const REGISTRATION_MCP_TOOLS: RegistrationMcpTool[] = [
  {
    name:        'get_registration_options',
    description: 'Return available login methods and social providers enabled for the tenant.',
    tier:        'auto',
    riskLevel:   1,
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name:        'create_provisional_profile',
    description: 'Create an incomplete customer record after social login or lead capture. Requires email verification to activate.',
    tier:        'auto',
    riskLevel:   2,
    inputSchema: {
      type: 'object',
      required: ['email', 'name', 'source'],
      properties: {
        email:            { type: 'string', format: 'email' },
        name:             { type: 'string' },
        source:           { type: 'string', enum: ['google', 'facebook', 'apple', 'microsoft', 'linkedin', 'email', 'facebook_lead_form', 'instagram_lead_form', 'linkedin_lead_form'] },
        externalUserId:   { type: 'string', description: 'OAuth subject claim or lead ID' },
        mobile:           { type: 'string' },
      },
    },
    safetyNote: 'Profile is provisional until email/mobile verified',
  },
  {
    name:        'find_existing_customer',
    description: 'Detect duplicate accounts by email, mobile, or external social ID before creating a new record.',
    tier:        'auto',
    riskLevel:   1,
    inputSchema: {
      type: 'object',
      properties: {
        email:          { type: 'string' },
        mobile:         { type: 'string' },
        externalUserId: { type: 'string' },
      },
    },
    safetyNote: 'Returns existence flag and masked email only — not full profile',
  },
  {
    name:        'capture_social_lead',
    description: 'Store a lead submitted through a Facebook/Instagram/LinkedIn lead form via webhook.',
    tier:        'auto',
    riskLevel:   1,
    inputSchema: {
      type: 'object',
      required: ['source', 'name', 'email', 'marketingConsent'],
      properties: {
        source:           { type: 'string', enum: ['facebook_lead_form', 'instagram_lead_form', 'linkedin_lead_form', 'google_ads'] },
        name:             { type: 'string' },
        email:            { type: 'string', format: 'email' },
        mobile:           { type: 'string' },
        interest:         { type: 'string' },
        adCampaignId:     { type: 'string' },
        externalLeadId:   { type: 'string' },
        marketingConsent: { type: 'boolean' },
        rawPayload:       { type: 'object' },
      },
    },
    safetyNote: 'Lead remains provisional until verification. Duplicate check runs automatically.',
  },
  {
    name:        'send_verification',
    description: 'Send email or SMS verification to a provisional customer. Rate-limited.',
    tier:        'rate_limited',
    riskLevel:   1,
    inputSchema: {
      type: 'object',
      required: ['customerId', 'channel'],
      properties: {
        customerId: { type: 'string' },
        channel:    { type: 'string', enum: ['email', 'sms'] },
      },
    },
    safetyNote: 'Rate-limited: max 3 per customerId per hour',
  },
  {
    name:        'complete_registration',
    description: 'Finalize a provisional profile after all required fields and verifications are satisfied.',
    tier:        'customer_confirm',
    riskLevel:   2,
    inputSchema: {
      type: 'object',
      required: ['customerId', 'yogaGoal', 'experienceLevel', 'termsVersion', 'privacyVersion'],
      properties: {
        customerId:      { type: 'string' },
        yogaGoal:        { type: 'string' },
        experienceLevel: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
        preferredStyle:  { type: 'string' },
        preferredDays:   { type: 'array', items: { type: 'string' } },
        termsVersion:    { type: 'string' },
        privacyVersion:  { type: 'string' },
      },
    },
  },
  {
    name:        'start_onboarding_form',
    description: 'Launch the yoga goal questionnaire for a newly registered customer.',
    tier:        'auto',
    riskLevel:   1,
    inputSchema: {
      type: 'object',
      required: ['customerId'],
      properties: {
        customerId: { type: 'string' },
      },
    },
  },
  {
    name:        'record_marketing_consent',
    description: 'Store explicit marketing opt-in/opt-out consent with source attribution.',
    tier:        'customer_confirm',
    riskLevel:   1,
    inputSchema: {
      type: 'object',
      required: ['customerId', 'consentType', 'granted', 'version', 'ipAddress'],
      properties: {
        customerId:   { type: 'string' },
        consentType:  { type: 'string', enum: ['marketing_emails', 'marketing_sms', 'data_processing', 'recording_consent'] },
        granted:      { type: 'boolean' },
        version:      { type: 'string' },
        ipAddress:    { type: 'string' },
        userAgent:    { type: 'string' },
      },
    },
    safetyNote: 'Consent records are immutable once written; only revoke creates a new record',
  },
  {
    name:        'convert_lead_to_customer',
    description: 'Convert a verified social lead to a full customer account.',
    tier:        'auto',
    riskLevel:   2,
    inputSchema: {
      type: 'object',
      required: ['leadId', 'customerId'],
      properties: {
        leadId:     { type: 'string' },
        customerId: { type: 'string' },
      },
    },
    safetyNote: 'Lead must be in verified status. Triggers welcome notification.',
  },
  {
    name:        'delete_registration_data',
    description: 'Remove abandoned or personal registration data. Restricted — requires approval.',
    tier:        'restricted',
    riskLevel:   3,
    inputSchema: {
      type: 'object',
      required: ['customerId', 'reason', 'approvedBy'],
      properties: {
        customerId: { type: 'string' },
        reason:     { type: 'string', enum: ['customer_request', 'abandoned', 'gdpr_erasure', 'dpdp_erasure'] },
        approvedBy: { type: 'string' },
      },
    },
    safetyNote: 'Irreversible. GDPR/DPDP right-to-erasure. Audit record retained per legal requirement.',
  },
];

export const REGISTRATION_MCP_TOOL_COUNT = REGISTRATION_MCP_TOOLS.length; // 10

export function getRegistrationMcpTool(name: string): RegistrationMcpTool | undefined {
  return REGISTRATION_MCP_TOOLS.find((t) => t.name === name);
}
