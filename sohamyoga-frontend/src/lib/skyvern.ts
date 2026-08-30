type SkyvernConfig={baseUrl:string;apiKey:string};
export type SkyvernRun={run_id:string;status:string;app_url?:string;browser_session_id?:string;failure_reason?:string;finished_at?:string};

async function config():Promise<SkyvernConfig>{
 if(process.env.SKYVERN_API_KEY)return{baseUrl:process.env.SKYVERN_BASE_URL||'http://127.0.0.1:18000',apiKey:process.env.SKYVERN_API_KEY};
 const address=process.env.OPENBAO_ADDR, token=process.env.OPENBAO_ROOT_TOKEN;
 if(!address||!token)throw new Error('Skyvern credential is unavailable. Configure SKYVERN_API_KEY or OpenBao runtime access.');
 const response=await fetch(`${address}/v1/secret/data/sohamyoga-portal/skyvern`,{headers:{'X-Vault-Token':token},cache:'no-store',signal:AbortSignal.timeout(5_000)});
 if(!response.ok)throw new Error(`OpenBao could not provide the Skyvern credential (${response.status}).`);
 const body=await response.json() as {data?:{data?:{api_key?:string;base_url?:string}}};
 const value=body.data?.data;if(!value?.api_key)throw new Error('OpenBao Skyvern credential is empty.');
 return{baseUrl:value.base_url||'http://127.0.0.1:18000',apiKey:value.api_key};
}

async function request<T>(path:string,init?:RequestInit):Promise<T>{
 const cfg=await config();const response=await fetch(`${cfg.baseUrl}${path}`,{...init,headers:{'Content-Type':'application/json','x-api-key':cfg.apiKey,...init?.headers},cache:'no-store',signal:AbortSignal.timeout(15_000)});
 const text=await response.text();if(!response.ok)throw new Error(`Skyvern ${path} failed (${response.status}): ${text.slice(0,300)}`);
 return(text?JSON.parse(text):{}) as T;
}

export async function skyvernHealth(){
 const baseUrl=process.env.SKYVERN_BASE_URL||'http://127.0.0.1:18000';
 const response=await fetch(`${baseUrl}/api/v1/heartbeat`,{cache:'no-store',signal:AbortSignal.timeout(3_000)});
 return{healthy:response.ok,status:response.status,baseUrl,uiUrl:process.env.SKYVERN_UI_URL||'http://127.0.0.1:18080'};
}

export function provisioningPrompt(platform:string,accountName:string){
 return `Assist with the approved ${platform} developer-portal setup for ${accountName}. Fill only ordinary, pre-approved business profile fields and navigate reversible configuration screens. STOP IMMEDIATELY without entering, accepting, submitting, revealing, or extracting anything when you encounter CAPTCHA, OTP or MFA, QR/2FA setup, password entry, identity or business verification, legal terms acceptance, OAuth consent, payment, app review submission, credential/client-secret display, account deletion, or another ambiguous irreversible action. Report the checkpoint for a human. Never attempt to bypass a platform security control. Do not expose cookies, tokens, secrets, recovery codes, or personal data in output. Extract only non-secret application/account IDs and public URLs.`;
}

export function startSkyvernTask(url:string,prompt:string){
 return request<SkyvernRun>('/v1/run/tasks',{method:'POST',body:JSON.stringify({url,prompt,engine:'skyvern-1.0',max_steps:30,include_action_history_in_verification:true})});
}
export function getSkyvernRun(runId:string){return request<SkyvernRun>(`/v1/runs/${encodeURIComponent(runId)}`);}

