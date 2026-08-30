import {canTransition} from '@/domain/social/provisioning';
describe('social provisioning state machine',()=>{
 it('allows the normal ordered path',()=>{expect(canTransition('DRAFT','PROFILE_READY')).toBe(true);expect(canTransition('OAUTH_CONNECTED','API_TESTED')).toBe(true)});
 it('rejects skipped security and readiness states',()=>{expect(canTransition('DRAFT','ACTIVE')).toBe(false);expect(canTransition('OAUTH_PENDING','API_TESTED')).toBe(false)});
 it('allows a formal human checkpoint and completion',()=>{expect(canTransition('WAITING_CAPTCHA','CAPTCHA_COMPLETED')).toBe(true);expect(canTransition('WAITING_EMAIL_OTP','EMAIL_VERIFIED')).toBe(true)});
 it('allows exception handling but makes cancellation terminal',()=>{expect(canTransition('SIGNUP_STARTED','BLOCKED')).toBe(true);expect(canTransition('CANCELLED','DRAFT')).toBe(false)});
});
