import {NextRequest} from 'next/server';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {requireAdmin} from '@/lib/admin-auth';
import {databaseConfigured,query} from '@/lib/postgres';
import {qualityDimensions,qualityStories} from '../../../../../tests/quality/test-stories';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Report={stats?:Record<string,number>;suites?:unknown[]};
function flatten(suites:any[]=[]):any[]{return suites.flatMap(s=>[...flatten(s.suites||[]),...(s.specs||[]).flatMap((p:any)=>(p.tests||[]).map((t:any)=>({title:p.title,status:t.results?.at(-1)?.status||'unknown',durationMs:t.results?.at(-1)?.duration||0,error:t.results?.at(-1)?.error?.message?.replace(/\x1b\[[0-9;]*m/g,'').slice(0,600)||''})))])}
export async function GET(req:NextRequest){const denied=await requireAdmin(req);if(denied)return denied;let report:Report={};try{report=JSON.parse(await readFile(path.join(process.cwd(),'test-results/unified-quality.json'),'utf8'))}catch{}
 let models:any[]=[];let jobs:any[]=[];if(databaseConfigured()){[models,jobs]=await Promise.all([query("SELECT provider,model_name,capability_codes,enabled FROM ai_model_master ORDER BY provider,model_name").then(x=>x.rows),query("SELECT status,count(*)::int count FROM module_test_run GROUP BY status ORDER BY status").then(x=>x.rows)])}
 return Response.json({generatedAt:new Date().toISOString(),dimensions:qualityDimensions,stories:qualityStories,run:{stats:report.stats||{},tests:flatten(report.suites as any[])},models,jobs,tools:{playwright:'installed',chromeCdp:'installed',axe:'installed',stagehand:'installed-local',cua:'stagehand-agent-ready; AI execution opt-in'}})}
