import {provisioningPrompt} from '@/lib/skyvern';
describe('Skyvern provisioning safety prompt',()=>{
 it('contains mandatory human stops and forbids bypass',()=>{const prompt=provisioningPrompt('linkedin','SohamYoga');expect(prompt).toContain('STOP IMMEDIATELY');expect(prompt).toContain('CAPTCHA');expect(prompt).toContain('OAuth consent');expect(prompt).toContain('Never attempt to bypass');expect(prompt).toContain('client-secret')});
 it('includes the scoped platform and account',()=>{expect(provisioningPrompt('discord','Soham Digital')).toContain('discord developer-portal setup for Soham Digital')});
});
