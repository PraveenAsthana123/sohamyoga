'use client';import{useCallback,useEffect,useMemo,useState}from'react';import Link from'next/link';
type Tenant={id:string;name:string;slug:string;status:string;plan:string;campaigns:number;awaiting_approval:number;video_assets:number;image_assets:number;connected_channels:number;published_posts:number;impressions:string;clicks:string;campaign_leads:number;social_leads:number;consented_leads:number;conversions:number;revenue:string;last_activity?:string};
type Capability={tenant_id:string;capability_key:string;domain:string;display_name:string;description:string;required_for_launch:boolean;maturity:string;provider?:string;blocker?:string};type Data={generatedAt:string;tenants:Tenant[];providers:{provider_name:string;is_configured:boolean;missing_vars:string[]}[];nps:{score:number;responses:number};responses:{conversations:number;open:number;rated:number;satisfaction:string};services:Record<string,boolean>;gaps:{capability:string;tool:string;ready:boolean;action:string}[];capabilities:Capability[];alerts:{severity:string;title:string}[]};
const EMPTY:Data={generatedAt:'',tenants:[],providers:[],nps:{score:0,responses:0},responses:{conversations:0,open:0,rated:0,satisfaction:'0'},services:{},gaps:[],capabilities:[],alerts:[]};
function Kpi({label,value,note}:{label:string;value:string|number;note?:string}){return <div className="rounded-xl border bg-white p-4"><div className="text-xs uppercase tracking-wide text-gray-500">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div>{note&&<div className="mt-1 text-xs text-gray-500">{note}</div>}</div>}

const METRIC_LABELS: Record<string, string> = { revenue_monthly: 'Revenue (month)', new_leads_monthly: 'New Leads (month)', bookings_monthly: 'Bookings (month)' };
interface Objective { metricKey: string; targetValue: number | null; actualValue: number; progressPercent: number | null; onTrack: boolean | null }
function ControlTowerObjectivesSection() {
  const [objectives, setObjectives] = useState<Objective[] | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    fetch('/api/admin/marketing/control-tower-objectives', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setObjectives(d?.objectives ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(metricKey: string) {
    const value = Number(inputs[metricKey]);
    if (!value || value <= 0) return;
    await fetch('/api/admin/marketing/control-tower-objectives', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metricKey, targetValue: value }),
    });
    load();
  }

  return (
    <section className="rounded-xl border bg-white p-5">
      <h2 className="font-semibold">Control Tower Objectives</h2>
      <p className="text-xs text-gray-500">Staff-set monthly targets vs. real month-to-date actuals.</p>
      {!objectives ? <p className="mt-3 text-sm text-gray-400">Loading…</p> : (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {objectives.map(o => (
            <div key={o.metricKey} className="rounded border p-3">
              <p className="text-xs font-medium text-gray-600">{METRIC_LABELS[o.metricKey]}</p>
              <p className="text-lg font-bold mt-1">{o.actualValue}{o.targetValue ? ` / ${o.targetValue}` : ''}</p>
              {o.progressPercent !== null ? (
                <p className={`text-xs mt-1 ${o.onTrack ? 'text-green-700' : 'text-amber-700'}`}>{o.progressPercent}% of target · {o.onTrack ? 'on track' : 'behind pace'}</p>
              ) : <p className="text-xs text-gray-400 mt-1">No target set</p>}
              <div className="flex gap-1 mt-2">
                <input value={inputs[o.metricKey] ?? ''} onChange={e => setInputs(i => ({ ...i, [o.metricKey]: e.target.value }))}
                  placeholder="Set target" type="number" className="flex-1 border rounded px-2 py-1 text-xs" />
                <button onClick={() => save(o.metricKey)} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">Set</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

interface Snapshot { id: string; capturedAt: string; revenueLast24h: number; dbReachable: boolean; dbQueryMs: number | null }
interface Correlation { snapshotCount: number; sufficientData: boolean; pearsonR: number | null; interpretation: string }
function HealthCorrelationSection() {
  const [data, setData] = useState<{ correlation: Correlation; snapshots: Snapshot[] } | null>(null);
  useEffect(() => {
    fetch('/api/admin/marketing/health-correlation', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(setData);
  }, []);
  return (
    <section className="rounded-xl border bg-white p-5">
      <h2 className="font-semibold">Business → Technical Correlation</h2>
      <p className="text-xs text-gray-500">Hourly health_snapshot rows (revenue/leads/bookings vs. DB latency). Correlation needs 3+ real snapshots.</p>
      {!data ? <p className="mt-3 text-sm text-gray-400">Loading…</p> : (
        <>
          <p className="mt-3 text-sm">{data.correlation.interpretation}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b text-gray-500"><th className="p-1">Captured</th><th>Revenue (24h)</th><th>DB reachable</th><th>DB latency</th></tr></thead>
              <tbody>{data.snapshots.map(s => (
                <tr key={s.id} className="border-b">
                  <td className="p-1">{new Date(s.capturedAt).toLocaleString()}</td>
                  <td>${s.revenueLast24h.toFixed(2)}</td>
                  <td className={s.dbReachable ? 'text-green-700' : 'text-red-700'}>{s.dbReachable ? 'Yes' : 'No'}</td>
                  <td>{s.dbQueryMs ?? '—'}ms</td>
                </tr>
              ))}</tbody>
            </table>
            {!data.snapshots.length && <p className="p-3 text-gray-400">No snapshots captured yet — the hourly health-snapshot cron job populates this.</p>}
          </div>
        </>
      )}
    </section>
  );
}
export default function MarketingOperations(){const[data,setData]=useState<Data>(EMPTY);const[query,setQuery]=useState('');const[selected,setSelected]=useState('all');const[error,setError]=useState('');const load=useCallback(()=>fetch('/api/admin/marketing-operations',{cache:'no-store'}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error);setData(b)}).catch(e=>setError(e.message)),[]);useEffect(()=>{void load();const id=setInterval(load,30000);return()=>clearInterval(id)},[load]);
 const visible=useMemo(()=>data.tenants.filter(t=>(selected==='all'||t.id===selected)&&`${t.name} ${t.slug}`.toLowerCase().includes(query.toLowerCase())),[data.tenants,selected,query]);const capabilityTenant=selected==='all'?data.tenants[0]?.id:selected;const capabilityRows=data.capabilities.filter(c=>c.tenant_id===capabilityTenant);const total=(key:keyof Tenant)=>visible.reduce((n,t)=>n+Number(t[key]||0),0);
 return <div className="mx-auto max-w-[1600px] space-y-6 p-6"><header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Multi-Customer Marketing Operations</h1><p className="text-sm text-gray-600">Real campaign, social, response, NPS, funnel and readiness monitoring. Global-only metrics are identified.</p></div><div className="flex gap-2"><button onClick={load} className="rounded border bg-white px-3 py-2 text-sm">Refresh</button><Link href="/admin/marketing-command" className="rounded bg-indigo-700 px-3 py-2 text-sm text-white">Create campaign</Link></div></header>{error&&<div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}
 <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Kpi label="Customers" value={visible.length}/><Kpi label="Campaigns" value={total('campaigns')}/><Kpi label="Awaiting approval" value={total('awaiting_approval')}/><Kpi label="Published posts" value={total('published_posts')}/><Kpi label="Leads" value={total('campaign_leads')+total('social_leads')}/><Kpi label="Conversions" value={total('conversions')}/></section>
 <section className="rounded-xl border bg-white p-4"><div className="flex flex-wrap gap-3"><input aria-label="Search customers" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search customers" className="rounded border px-3 py-2 text-sm"/><select aria-label="Customer" value={selected} onChange={e=>setSelected(e.target.value)} className="rounded border px-3 py-2 text-sm"><option value="all">All customers</option>{data.tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><span className="self-center text-xs text-gray-500">Refreshes every 30 seconds · {data.generatedAt&&new Date(data.generatedAt).toLocaleString()}</span></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-gray-500"><th className="p-2">Customer</th><th>Campaigns</th><th>Approval</th><th>Channels</th><th>Text/Image/Video</th><th>Posts</th><th>Views/Clicks</th><th>Leads/Consent</th><th>Conversion</th><th>Revenue</th></tr></thead><tbody>{visible.map(t=><tr key={t.id} className="border-b"><td className="p-2"><strong>{t.name}</strong><div className="text-xs text-gray-500">{t.plan} · {t.status}</div></td><td>{t.campaigns}</td><td className={t.awaiting_approval?'text-amber-700 font-semibold':''}>{t.awaiting_approval}</td><td>{t.connected_channels}</td><td>{t.campaigns}/{t.image_assets}/{t.video_assets}</td><td>{t.published_posts}</td><td>{t.impressions}/{t.clicks}</td><td>{t.campaign_leads+t.social_leads}/{t.consented_leads}</td><td>{t.conversions}</td><td>${Number(t.revenue).toFixed(2)}</td></tr>)}</tbody></table>{!visible.length&&<p className="p-5 text-gray-500">No matching customers.</p>}</div></section>
 <div className="grid gap-6 lg:grid-cols-3"><section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Customer responses</h2><p className="text-xs text-amber-700">Global: chat schema has no tenant key.</p><div className="mt-3 grid grid-cols-2 gap-2"><Kpi label="Conversations" value={data.responses.conversations}/><Kpi label="Open" value={data.responses.open}/><Kpi label="Rated" value={data.responses.rated}/><Kpi label="Satisfaction" value={data.responses.satisfaction||0}/></div></section><section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">NPS</h2><p className="text-xs text-amber-700">Global survey rollup; tenant attribution is not available.</p><div className="mt-4 text-4xl font-bold">{data.nps.score}</div><p className="text-sm text-gray-500">{data.nps.responses} responses</p></section><section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Runtime</h2><div className="mt-3 space-y-2">{Object.entries(data.services).map(([name,ok])=><div key={name} className="flex justify-between"><span className="capitalize">{name}</span><span className={ok?'text-green-700':'text-red-700'}>{ok?'Ready':'Unavailable'}</span></div>)}</div></section></div>
 <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">20-capability maturity map</h2><p className="text-xs text-gray-500">Showing {data.tenants.find(t=>t.id===capabilityTenant)?.name||'selected customer'}. Installed does not mean connected; verified outcomes require live business results.</p><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{capabilityRows.map(c=><article key={c.capability_key} className="rounded border p-3"><div className="flex justify-between gap-2"><strong>{c.display_name}</strong><span className={`text-xs ${c.maturity==='verified_outcomes'?'text-green-700':c.maturity==='missing'?'text-red-700':'text-amber-700'}`}>{c.maturity.replaceAll('_',' ')}</span></div><div className="text-xs uppercase text-gray-400">{c.domain}{c.required_for_launch?' · launch gate':''}</div><p className="mt-2 text-xs text-gray-600">{c.description}</p>{c.provider&&<p className="mt-2 text-xs">Provider: {c.provider}</p>}{c.blocker&&<p className="mt-1 text-xs text-amber-700">{c.blocker}</p>}</article>)}</div></section>
 <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Channel readiness</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{data.providers.map(p=><div key={p.provider_name} className="rounded border p-3"><div className="flex justify-between"><strong>{p.provider_name}</strong><span className={p.is_configured?'text-green-700':'text-amber-700'}>{p.is_configured?'Ready':'Setup'}</span></div>{!p.is_configured&&<p className="mt-1 text-xs text-gray-500">{p.missing_vars?.join(', ')}</p>}</div>)}</div></section>
 <section className="rounded-xl border bg-slate-50 p-5"><h2 className="font-semibold">Missing tools and connections</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{data.gaps.map(g=><article key={g.capability} className="rounded border bg-white p-3"><div className="flex justify-between gap-2"><strong>{g.capability}</strong><span className={g.ready?'text-green-700':'text-amber-700'}>{g.ready?'Ready':'Missing'}</span></div><div className="text-sm text-gray-600">{g.tool}</div><p className="mt-1 text-xs text-gray-500">{g.action}</p></article>)}</div></section>
 <ControlTowerObjectivesSection />
 <HealthCorrelationSection /></div>}
