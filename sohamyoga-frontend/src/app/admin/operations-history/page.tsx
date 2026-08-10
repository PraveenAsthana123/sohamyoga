'use client';
import { useEffect,useState } from 'react';

type Data={summary:Record<string,number>;runs:Array<Record<string,unknown>>;errors:Array<Record<string,unknown>>;circuits:Array<Record<string,unknown>>;models:Array<Record<string,unknown>>};
export default function OperationsHistoryPage(){
 const [data,setData]=useState<Data|null>(null); const [error,setError]=useState('');
 const load=()=>fetch('/api/admin/operations-history',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Load failed');setData(d)}).catch(e=>setError(e.message));
 useEffect(()=>{void load()},[]);
 return <div className="mx-auto max-w-7xl space-y-5 p-6"><header className="flex justify-between"><div><h1 className="text-2xl font-bold">Operations History</h1><p className="text-sm text-gray-500">Correlated runs, errors, models and circuit breakers across every runtime.</p></div><button onClick={load} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white">Refresh</button></header>
 {error&&<div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
 <section className="grid gap-3 sm:grid-cols-4">{Object.entries(data?.summary||{}).map(([k,v])=><div key={k} className="rounded-xl border bg-white p-4"><div className="text-xs uppercase text-gray-500">{k.replaceAll('_',' ')}</div><strong className="text-xl">{String(v??0)}</strong></div>)}</section>
 <Panel title="Circuit breakers" rows={data?.circuits||[]} columns={['component_key','circuit_key','state','failure_count','success_count','updated_at']}/>
 <Panel title="Model history" rows={data?.models||[]} columns={['provider','model_name','calls','failures','avg_latency_ms','last_called_at']}/>
 <Panel title="Open and historical errors" rows={data?.errors||[]} columns={['component_key','error_code','severity','message','occurrence_count','resolved','last_seen_at']}/>
 <Panel title="Recent operations" rows={data?.runs||[]} columns={['created_at','component_key','operation_type','operation_name','status','duration_ms','trace_id']}/></div>;
}
function Panel({title,rows,columns}:{title:string;rows:Array<Record<string,unknown>>;columns:string[]}){return <section className="overflow-hidden rounded-xl border bg-white"><h2 className="p-4 font-semibold">{title} ({rows.length})</h2><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left text-xs">{columns.map(c=><th key={c} className="p-2">{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={String(r.id||i)} className="border-t">{columns.map(c=><td key={c} className="max-w-sm truncate p-2 font-mono text-xs">{String(r[c]??'')}</td>)}</tr>)}</tbody></table></div></section>}
