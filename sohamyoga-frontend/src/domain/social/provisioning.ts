export const PROVISIONING_STATES = [
  'DRAFT', 'PROFILE_READY', 'VALIDATION_PASSED', 'SIGNUP_STARTED',
  'WAITING_EMAIL_OTP', 'EMAIL_VERIFIED', 'WAITING_PHONE_OTP', 'PHONE_VERIFIED',
  'WAITING_CAPTCHA', 'CAPTCHA_COMPLETED', 'WAITING_2FA', 'TWO_FACTOR_CONFIGURED',
  'ACCOUNT_CREATED', 'BUSINESS_VERIFICATION_PENDING', 'BUSINESS_VERIFIED',
  'DEVELOPER_APP_PENDING', 'DEVELOPER_APP_CREATED', 'OAUTH_PENDING',
  'OAUTH_CONNECTED', 'API_TESTED', 'PUBLISH_TESTED', 'ACTIVE',
  'FAILED', 'BLOCKED', 'REVIEW_REQUIRED', 'DOCUMENT_REQUIRED', 'ACCESS_DENIED',
  'API_PERMISSION_PENDING', 'TOKEN_EXPIRED', 'SUSPENDED', 'CANCELLED',
] as const;

export type ProvisioningState = typeof PROVISIONING_STATES[number];

const happyPath: ProvisioningState[] = [
  'DRAFT', 'PROFILE_READY', 'VALIDATION_PASSED', 'SIGNUP_STARTED',
  'ACCOUNT_CREATED', 'DEVELOPER_APP_PENDING', 'DEVELOPER_APP_CREATED',
  'OAUTH_PENDING', 'OAUTH_CONNECTED', 'API_TESTED', 'PUBLISH_TESTED', 'ACTIVE',
];

const checkpoints: Partial<Record<ProvisioningState, ProvisioningState>> = {
  WAITING_EMAIL_OTP: 'EMAIL_VERIFIED',
  WAITING_PHONE_OTP: 'PHONE_VERIFIED',
  WAITING_CAPTCHA: 'CAPTCHA_COMPLETED',
  WAITING_2FA: 'TWO_FACTOR_CONFIGURED',
  BUSINESS_VERIFICATION_PENDING: 'BUSINESS_VERIFIED',
};

const exceptions = new Set<ProvisioningState>([
  'FAILED', 'BLOCKED', 'REVIEW_REQUIRED', 'DOCUMENT_REQUIRED', 'ACCESS_DENIED',
  'API_PERMISSION_PENDING', 'TOKEN_EXPIRED', 'SUSPENDED', 'CANCELLED',
]);

export function canTransition(from: ProvisioningState, to: ProvisioningState): boolean {
  if (from === to) return false;
  if (exceptions.has(to)) return from !== 'CANCELLED';
  if (checkpoints[from] === to) return true;
  if (exceptions.has(from)) return to === 'REVIEW_REQUIRED' || to === 'CANCELLED';
  const index = happyPath.indexOf(from);
  return index >= 0 && happyPath[index + 1] === to;
}

export const HUMAN_TASK_TYPES = [
  'CAPTCHA', 'EMAIL_OTP', 'PHONE_OTP', 'TWO_FACTOR_SETUP', 'OAUTH_APPROVAL',
  'IDENTITY_VERIFICATION', 'BUSINESS_VERIFICATION', 'TERMS_ACCEPTANCE',
] as const;

export interface PlatformRequirementFlags {
  requires_captcha: boolean; requires_otp: boolean; requires_phone: boolean; requires_2fa: boolean;
  requires_identity_verification: boolean; requires_business_verification: boolean; oauth_supported: boolean;
}

// Derives the real starting human-task checklist for a new provisioning job
// directly from that platform's own recorded requirement flags -- never a
// generic one-size-fits-all list. A platform with every flag false (rare)
// still gets TERMS_ACCEPTANCE, since every platform's terms require human
// agreement.
export function generateInitialHumanTasks(flags: PlatformRequirementFlags): { taskType: typeof HUMAN_TASK_TYPES[number]; instructions: string }[] {
  const tasks: { taskType: typeof HUMAN_TASK_TYPES[number]; instructions: string }[] = [];
  if (flags.requires_captcha) tasks.push({ taskType: 'CAPTCHA', instructions: 'Complete the platform\'s CAPTCHA challenge during signup. Never submit an automated CAPTCHA solve.' });
  if (flags.requires_otp) tasks.push({ taskType: 'EMAIL_OTP', instructions: 'Enter the one-time code sent to the account email to verify it.' });
  if (flags.requires_phone) tasks.push({ taskType: 'PHONE_OTP', instructions: 'Enter the one-time code sent by SMS to verify the phone number.' });
  if (flags.requires_2fa) tasks.push({ taskType: 'TWO_FACTOR_SETUP', instructions: 'Configure two-factor authentication and securely record the recovery codes.' });
  if (flags.requires_identity_verification) tasks.push({ taskType: 'IDENTITY_VERIFICATION', instructions: 'Submit and complete the platform\'s identity verification flow (government ID or equivalent).' });
  if (flags.requires_business_verification) tasks.push({ taskType: 'BUSINESS_VERIFICATION', instructions: 'Submit business verification documents (registration, domain, or tax ID as required) and wait for platform approval.' });
  if (flags.oauth_supported) tasks.push({ taskType: 'OAUTH_APPROVAL', instructions: 'Review the requested OAuth scopes and grant consent from the account owner\'s own login session.' });
  tasks.push({ taskType: 'TERMS_ACCEPTANCE', instructions: 'Read and accept the platform\'s terms of service and developer agreement.' });
  return tasks;
}

// Real, well-known bio-length conventions, mapped to the closest of the 3
// tiers social_brand_profile already provides (80/150/255) rather than
// inventing 35 bespoke exact limits with unverified confidence.
const SHORT_TIER_PLATFORMS = new Set(['tiktok', 'telegram']);
const LONG_TIER_PLATFORMS = new Set([
  'facebook', 'linkedin', 'youtube', 'github', 'gitlab', 'stack_overflow', 'google_business',
  'yelp', 'tripadvisor', 'trustpilot', 'vimeo', 'dailymotion', 'spotify', 'apple_podcasts',
  'soundcloud', 'patreon', 'medium', 'substack', 'quora_manual', 'twitch', 'whatsapp_business',
  'slack', 'dribbble',
]);
export function bioTierFor(platform: string): 'bio_80' | 'bio_150' | 'bio_255' {
  if (SHORT_TIER_PLATFORMS.has(platform)) return 'bio_80';
  if (LONG_TIER_PLATFORMS.has(platform)) return 'bio_255';
  return 'bio_150';
}

