import{adapterReadiness,publishFirstWave}from '@/domain/social/first-wave-adapters';

describe('first-wave social adapters',()=>{
 it('fails closed when runtime secrets are incomplete',()=>{
  expect(adapterReadiness('telegram',{bot_token:'token'})).toEqual({ready:false,missing:['chat_id']});
  expect(adapterReadiness('bluesky',{identifier:'owner.test'}).ready).toBe(false);
 });
 it('publishes Telegram text without exposing the token in the result',async()=>{
  const request=jest.fn(async()=>new Response(JSON.stringify({ok:true,result:{message_id:42}}),{status:200,headers:{'content-type':'application/json'}})) as unknown as typeof fetch;
  await expect(publishFirstWave('telegram',{text:'Approved update',externalAccountId:'channel',idempotencyKey:'draft-1'},{bot_token:'secret-token',chat_id:'@channel'},request)).resolves.toEqual({externalId:'42'});
  expect(request).toHaveBeenCalledTimes(1);
 });
 it('uses Mastodon idempotency and returns the provider identity',async()=>{
  const request=jest.fn(async()=>new Response(JSON.stringify({id:'99',url:'https://social.example/@yoga/99'}),{status:200,headers:{'content-type':'application/json'}})) as unknown as typeof fetch;
  const result=await publishFirstWave('mastodon',{text:'Approved update',externalAccountId:'yoga',idempotencyKey:'draft-99'},{instance_url:'https://social.example','access_token':'token'},request);
  expect(result.externalId).toBe('99');
  expect((request as jest.Mock).mock.calls[0][1].headers['Idempotency-Key']).toBe('draft-99');
 });
});
