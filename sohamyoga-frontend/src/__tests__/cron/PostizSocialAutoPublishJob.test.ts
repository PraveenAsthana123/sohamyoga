import{AUTOMATED_POSTIZ_PLATFORMS,automationPrerequisites,buildPostizPayload}from'@/cron/jobs/PostizSocialAutoPublishJob';
describe('Postiz social auto-publisher guardrails',()=>{
 it('includes Facebook, LinkedIn, and YouTube',()=>expect(AUTOMATED_POSTIZ_PLATFORMS).toEqual(['facebook','linkedin','youtube']));
 it('fails closed without the API key',()=>expect(automationPrerequisites(1,'').ready).toBe(false));
 it('requires an approved due connected variant',()=>expect(automationPrerequisites(0,'key').ready).toBe(false));
 it('builds the exact YouTube video attachment and settings shape',()=>{const payload=buildPostizPayload({draft_id:'d',tenant_id:'t',workspace_id:'w',adapted_text:'Description',account_id:'a',postiz_account_id:'integration',scheduled_at:new Date().toISOString(),platform:'youtube',video_title:'Yoga for Beginners',postiz_media_id:'media-1',postiz_media_path:'https://postiz.local/uploads/yoga.mp4',youtube_visibility:'unlisted',youtube_tags:['yoga']});expect(payload.posts[0].value[0].image).toEqual([{id:'media-1',path:'https://postiz.local/uploads/yoga.mp4'}]);expect(payload.posts[0].settings).toMatchObject({__type:'youtube',title:'Yoga for Beginners',type:'unlisted'});});
});
