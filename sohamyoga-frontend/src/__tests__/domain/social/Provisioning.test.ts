import {canTransition, generateInitialHumanTasks, bioTierFor} from '@/domain/social/provisioning';
describe('social provisioning state machine',()=>{
 it('allows the normal ordered path',()=>{expect(canTransition('DRAFT','PROFILE_READY')).toBe(true);expect(canTransition('OAUTH_CONNECTED','API_TESTED')).toBe(true)});
 it('rejects skipped security and readiness states',()=>{expect(canTransition('DRAFT','ACTIVE')).toBe(false);expect(canTransition('OAUTH_PENDING','API_TESTED')).toBe(false)});
 it('allows a formal human checkpoint and completion',()=>{expect(canTransition('WAITING_CAPTCHA','CAPTCHA_COMPLETED')).toBe(true);expect(canTransition('WAITING_EMAIL_OTP','EMAIL_VERIFIED')).toBe(true)});
 it('allows exception handling but makes cancellation terminal',()=>{expect(canTransition('SIGNUP_STARTED','BLOCKED')).toBe(true);expect(canTransition('CANCELLED','DRAFT')).toBe(false)});
});

describe('generateInitialHumanTasks',()=>{
 const none={requires_captcha:false,requires_otp:false,requires_phone:false,requires_2fa:false,requires_identity_verification:false,requires_business_verification:false,oauth_supported:false};
 it('always includes TERMS_ACCEPTANCE even when every flag is false',()=>{
  const tasks=generateInitialHumanTasks(none);
  expect(tasks).toHaveLength(1);
  expect(tasks[0].taskType).toBe('TERMS_ACCEPTANCE');
 });
 it('matches Telegram-shaped flags: captcha+otp+2fa but no oauth (no OAUTH_APPROVAL task)',()=>{
  const telegram={...none,requires_captcha:true,requires_otp:true,requires_2fa:true};
  const types=generateInitialHumanTasks(telegram).map(t=>t.taskType);
  expect(types).toEqual(['CAPTCHA','EMAIL_OTP','TWO_FACTOR_SETUP','TERMS_ACCEPTANCE']);
 });
 it('matches Instagram-shaped flags: adds OAUTH_APPROVAL and BUSINESS_VERIFICATION',()=>{
  const instagram={...none,requires_captcha:true,requires_otp:true,requires_2fa:true,requires_business_verification:true,oauth_supported:true};
  const types=generateInitialHumanTasks(instagram).map(t=>t.taskType);
  expect(types).toEqual(['CAPTCHA','EMAIL_OTP','TWO_FACTOR_SETUP','BUSINESS_VERIFICATION','OAUTH_APPROVAL','TERMS_ACCEPTANCE']);
 });
 it('adds PHONE_OTP only when requires_phone is true, independent of requires_otp',()=>{
  const phoneOnly={...none,requires_phone:true};
  const types=generateInitialHumanTasks(phoneOnly).map(t=>t.taskType);
  expect(types).toEqual(['PHONE_OTP','TERMS_ACCEPTANCE']);
 });
 it('every generated task has non-empty instructions',()=>{
  const all={requires_captcha:true,requires_otp:true,requires_phone:true,requires_2fa:true,requires_identity_verification:true,requires_business_verification:true,oauth_supported:true};
  for(const t of generateInitialHumanTasks(all)) expect(t.instructions.length).toBeGreaterThan(10);
 });
});

describe('bioTierFor',()=>{
 it('maps short-form platforms to bio_80',()=>{expect(bioTierFor('tiktok')).toBe('bio_80');expect(bioTierFor('telegram')).toBe('bio_80')});
 it('maps long-form/professional platforms to bio_255',()=>{expect(bioTierFor('linkedin')).toBe('bio_255');expect(bioTierFor('youtube')).toBe('bio_255');expect(bioTierFor('github')).toBe('bio_255')});
 it('defaults unlisted/mid-length platforms to bio_150',()=>{expect(bioTierFor('instagram')).toBe('bio_150');expect(bioTierFor('x_twitter')).toBe('bio_150');expect(bioTierFor('some_future_platform')).toBe('bio_150')});
});
