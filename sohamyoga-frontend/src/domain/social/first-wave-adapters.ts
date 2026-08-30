export type FirstWavePlatform='telegram'|'discord'|'bluesky'|'mastodon';
export type RuntimeSecret=Record<string,string>;
export type PublishInput={text:string;externalAccountId:string;idempotencyKey:string};
export type PublishResult={externalId?:string;externalUrl?:string};

const required:Record<FirstWavePlatform,string[]>={
 telegram:['bot_token','chat_id'],
 discord:['webhook_url'],
 bluesky:['identifier','app_password'],
 mastodon:['instance_url','access_token'],
};

export function adapterReadiness(platform:FirstWavePlatform,secret:RuntimeSecret){
 const missing=required[platform].filter(key=>!secret[key]?.trim());
 return missing.length?{ready:false,missing}:{ready:true,missing:[]};
}

async function json(response:Response){
 const body=await response.json().catch(()=>({})) as Record<string,any>;
 if(!response.ok)throw new Error(`Provider rejected publish (${response.status})`);
 return body;
}

export async function publishFirstWave(platform:FirstWavePlatform,input:PublishInput,secret:RuntimeSecret,request:typeof fetch=fetch):Promise<PublishResult>{
 const readiness=adapterReadiness(platform,secret);
 if(!readiness.ready)throw new Error(`Missing ${platform} runtime configuration: ${readiness.missing.join(', ')}`);
 if(!input.text.trim())throw new Error('Approved post text is required');

 if(platform==='telegram'){
  const body=await json(await request(`https://api.telegram.org/bot${secret.bot_token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:secret.chat_id,text:input.text})}));
  return{externalId:String(body.result?.message_id||'')||undefined};
 }
 if(platform==='discord'){
  const response=await request(secret.webhook_url,{method:'POST',headers:{'content-type':'application/json','X-Idempotency-Key':input.idempotencyKey},body:JSON.stringify({content:input.text})});
  if(!response.ok)throw new Error(`Provider rejected publish (${response.status})`);
  return{};
 }
 if(platform==='mastodon'){
  const base=new URL(secret.instance_url);base.pathname='/api/v1/statuses';base.search='';
  const body=await json(await request(base,{method:'POST',headers:{authorization:`Bearer ${secret.access_token}`,'content-type':'application/json','Idempotency-Key':input.idempotencyKey},body:JSON.stringify({status:input.text})}));
  return{externalId:body.id,externalUrl:body.url};
 }
 const session=await json(await request('https://bsky.social/xrpc/com.atproto.server.createSession',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:secret.identifier,password:secret.app_password})}));
 const now=new Date().toISOString();
 const post=await json(await request('https://bsky.social/xrpc/com.atproto.repo.createRecord',{method:'POST',headers:{authorization:`Bearer ${session.accessJwt}`,'content-type':'application/json'},body:JSON.stringify({repo:session.did,collection:'app.bsky.feed.post',record:{$type:'app.bsky.feed.post',text:input.text,createdAt:now}})}));
 return{externalId:post.cid,externalUrl:post.uri};
}
