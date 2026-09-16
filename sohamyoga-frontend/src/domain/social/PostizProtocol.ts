export const PROVIDERS: Record<string,readonly string[]>={facebook:['facebook'],instagram:['instagram','instagram-standalone'],linkedin:['linkedin','linkedin-page'],x_twitter:['x'],youtube:['youtube']};
export function providerFor(platform:string,identifier:string):string {
 if(!PROVIDERS[platform]?.includes(identifier))throw Error('Postiz integration provider does not match selected platform');
 return identifier;
}
/** Creation returns a queue/job id, never a confirmed external publication id. */
export function acceptedPostId(body:unknown,integrationId:string):string {
 if(!Array.isArray(body))throw Error('Unrecognized Postiz acceptance response; reconcile before retrying');
 const rows=body.filter(x=>x&&x.integration===integrationId&&typeof x.postId==='string'&&x.postId.trim());
 if(rows.length!==1)throw Error('Missing or ambiguous Postiz job id; reconcile before retrying');
 return rows[0].postId;
}
export function publicationReceipt(body:unknown,jobId:string,integrationId:string):{status:'queued'|'failed'|'published';url?:string} {
 const rows=(body as {posts?:unknown[]})?.posts;
 if(!Array.isArray(rows))throw Error('Unrecognized Postiz status response');
 const row=rows.find((x:any)=>x?.id===jobId&&x?.integration?.id===integrationId) as {state?:string;releaseURL?:string}|undefined;
 if(!row)return {status:'queued'};
 if(row.state==='ERROR')return {status:'failed'};
 if(row.state==='PUBLISHED'&&typeof row.releaseURL==='string') {
  try {const url=new URL(row.releaseURL);if(url.protocol==='https:'&&!url.username&&!url.password)return {status:'published',url:url.href};}catch{}
 }
 return {status:'queued'};
}
