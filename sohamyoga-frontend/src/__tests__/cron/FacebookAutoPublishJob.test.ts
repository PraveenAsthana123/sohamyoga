import {automationPrerequisites} from '@/cron/jobs/FacebookAutoPublishJob';
describe('FacebookAutoPublishJob guardrails',()=>{
 it('blocks without the server API key',()=>expect(automationPrerequisites(1,'')).toEqual({ready:false,reason:'POSTIZ_PUBLIC_API_KEY is missing'}));
 it('blocks without an approved due connected candidate',()=>expect(automationPrerequisites(0,'key')).toEqual({ready:false,reason:'no approved due Facebook Page draft with a connected account'}));
 it('runs only when both prerequisites exist',()=>expect(automationPrerequisites(1,'key').ready).toBe(true));
});
