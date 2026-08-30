import{NextRequest}from'next/server';import{getAdminPrincipal}from'@/lib/admin-auth';import{databaseConfigured,query}from'@/lib/postgres';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function probe(url:string){try{const r=await fetch(url,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(2500)});return r.status>0&&r.status<500}catch{return false}}
export async function GET(req:NextRequest){const auth=await getAdminPrincipal(req);if(auth.denied)return auth.denied;if(!databaseConfigured())return Response.json({error:'DATABASE_URL is not configured.'},{status:503});
 const tenants=await query(`SELECT t.id,t.name,t.slug,t.status,t.plan,
  (SELECT count(*)::int FROM marketing_automation_request r WHERE r.tenant_id=t.id) campaigns,
  (SELECT count(*)::int FROM marketing_automation_request r WHERE r.tenant_id=t.id AND r.status='review_required') awaiting_approval,
  (SELECT count(*)::int FROM generated_marketing_asset a WHERE a.tenant_id=t.id AND a.asset_type IN('video','video_script')) video_assets,
  (SELECT count(*)::int FROM generated_marketing_asset a WHERE a.tenant_id=t.id AND a.asset_type IN('static_banner','dynamic_banner','thumbnail')) image_assets,
  (SELECT count(*)::int FROM social_account a WHERE a.tenant_id=t.id AND a.status='connected') connected_channels,
  (SELECT count(*)::int FROM social_post p WHERE p.tenant_id=t.id AND p.status='published') published_posts,
  (SELECT coalesce(sum(x.impressions),0)::bigint FROM social_post_analytics x WHERE x.tenant_id=t.id) impressions,
  (SELECT coalesce(sum(x.clicks),0)::bigint FROM social_post_analytics x WHERE x.tenant_id=t.id) clicks,
  (SELECT count(*)::int FROM campaign_lead l WHERE l.tenant_id=t.id) campaign_leads,
  (SELECT count(*)::int FROM social_lead l WHERE l.tenant_id=t.id::text) social_leads,
  (SELECT count(*)::int FROM social_lead l WHERE l.tenant_id=t.id::text AND l.marketing_consent=true) consented_leads,
  (SELECT count(*)::int FROM funnel_stage_snapshot f WHERE f.tenant_id=t.id AND f.stage='conversion' AND f.period_end=(SELECT max(f2.period_end) FROM funnel_stage_snapshot f2 WHERE f2.tenant_id=t.id)) conversions,
  (SELECT coalesce(sum(c.revenue_cad),0)::numeric FROM campaign_analytics c WHERE c.tenant_id=t.id) revenue,
  (SELECT max(r.updated_at) FROM marketing_automation_request r WHERE r.tenant_id=t.id) last_activity
 FROM tenant t ORDER BY t.name LIMIT 250`);
 const [providers,nps,responses,capabilities,alerts,services]=await Promise.all([
  query(`SELECT provider_name,is_configured,missing_vars,checked_at FROM postiz_provider_status ORDER BY provider_name`),
  query(`SELECT coalesce(round(avg(nps_score)),0)::int score,coalesce(sum(total_responses),0)::int responses FROM v_nps_leaderboard`),
  query(`SELECT count(*)::int conversations,count(*) FILTER(WHERE status='open')::int open,count(*) FILTER(WHERE satisfaction_score IS NOT NULL)::int rated,round(avg(satisfaction_score)::numeric,1) satisfaction FROM chat_conversation`),
  query(`SELECT s.tenant_id,c.capability_key,c.domain,c.display_name,c.description,c.required_for_launch,c.sort_order,s.maturity,s.provider,s.blocker,s.last_health_at FROM tenant_marketing_capability s JOIN marketing_capability_definition c ON c.capability_key=s.capability_key ORDER BY s.tenant_id,c.sort_order`),
  query(`SELECT tenant_id,severity,alert_type,title,status,detected_at FROM marketing_operational_alert WHERE status='open' ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,detected_at DESC LIMIT 100`),
  Promise.all([probe(process.env.MAUTIC_URL||'http://127.0.0.1:18090'),probe(process.env.POSTIZ_CLIENT_URL||'http://127.0.0.1:15080'),probe(process.env.OLLAMA_URL||'http://127.0.0.1:11434/api/tags'),probe(process.env.ACTIVEPIECES_HEALTH_URL||'http://127.0.0.1:18181/api/v1/health')])]);
 const gaps=[
  {capability:'Campaign journeys, email, scoring',tool:'Mautic',ready:services[0],action:'Configure SMTP, HTTPS tracking, consent and suppression lists'},
  {capability:'Social scheduling and publishing',tool:'Postiz',ready:services[1]&&providers.rows.some((p:any)=>p.is_configured),action:'Add API key and connect provider OAuth accounts'},
  {capability:'AI copy and response drafts',tool:'Ollama',ready:services[2],action:'Add response-assistant review queue; never auto-send'},
  {capability:'Cross-system orchestration',tool:'Activepieces',ready:services[3],action:services[3]?'Create tenant-scoped, approval-gated workflows':'Restore the Activepieces runtime'},
  {capability:'Image rendering',tool:'ComfyUI',ready:false,action:'Connect renderer to approved image prompts'},
  {capability:'Video rendering/editing',tool:'ComfyUI/FFmpeg',ready:false,action:'Connect MP4 renderer, captions and thumbnail output'},
  {capability:'Unified social inbox',tool:'Chatwoot',ready:false,action:'Connect WhatsApp and supported messaging channels'},
 ];
 return Response.json({generatedAt:new Date().toISOString(),tenants:tenants.rows,providers:providers.rows,nps:nps.rows[0],responses:responses.rows[0],capabilities:capabilities.rows,alerts:alerts.rows,services:{mautic:services[0],postiz:services[1],ollama:services[2],activepieces:services[3]},gaps});}
