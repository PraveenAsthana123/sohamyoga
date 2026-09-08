'use client';
import { useCallback, useEffect, useState } from 'react';

type Event={id:string;direction:string;type:string;text:string|null;occurredAt:string};
type Thread={id:string;platform_key:string;customer_reference:string|null;status:string;event_count:number;recent_events:Event[];last_inbound_at:string|null};
type Summary={total:number;open:number;waiting_agent:number;waiting_customer:number;resolved:number};

export default function CustomerResponsesPage(){
 const [threads,setThreads]=useState<Thread[]>([]);const [summary,setSummary]=useState<Summary>({total:0,open:0,waiting_agent:0,waiting_customer:0,resolved:0});
 const [status,setStatus]=useState('');const [platform,setPlatform]=useState('');const [error,setError]=useState('');
 const load=useCallback(async()=>{const p=new URLSearchParams();if(status)p.set('status',status);if(platform)p.set('platform',platform);const r=await fetch(`/api/admin/customer-responses?${p}`,{cache:'no-store'});const d=await r.json();if(!r.ok){setError(d.error??'Unable to load responses.');return;}setThreads(d.threads??[]);setSummary(d.summary??{});setError('');},[status,platform]);
 useEffect(()=>{void load();},[load]);
 async function change(id:string,next:string){const r=await fetch(`/api/admin/customer-responses/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:next})});if(r.ok)await load();else setError((await r.json()).error);}
 const platforms=[...new Set(threads.map(t=>t.platform_key))];
 return <main className="min-h-screen bg-slate-950 p-6 text-slate-100"><div className="mx-auto max-w-7xl space-y-6">
  <header><h1 className="text-3xl font-bold">Customer Response Command Center</h1><p className="mt-1 text-slate-400">One auditable inbox for comments, replies, mentions, DMs, email responses, clicks, likes, follows, leads, and conversions.</p></header>
  <section className="grid gap-3 sm:grid-cols-5">{Object.entries(summary).map(([k,v])=><div key={k} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-2xl font-bold">{v}</div><div className="text-xs uppercase text-slate-400">{k.replace('_',' ')}</div></div>)}</section>
  <section className="flex flex-wrap gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"><select value={status} onChange={e=>setStatus(e.target.value)} className="rounded bg-slate-800 p-2"><option value="">All statuses</option>{['open','waiting_agent','waiting_customer','resolved','blocked','spam'].map(x=><option key={x}>{x}</option>)}</select><select value={platform} onChange={e=>setPlatform(e.target.value)} className="rounded bg-slate-800 p-2"><option value="">All platforms</option>{platforms.map(x=><option key={x}>{x}</option>)}</select><button onClick={()=>void load()} className="rounded bg-indigo-600 px-4">Refresh</button>{error&&<span className="text-red-300">{error}</span>}</section>
  <section className="space-y-3">{threads.map(t=><article key={t.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="rounded bg-indigo-950 px-2 py-1 text-xs text-indigo-300">{t.platform_key}</span><h2 className="mt-2 font-semibold">{t.customer_reference||'Unresolved customer'}</h2><p className="text-xs text-slate-500">{t.event_count} recent events · {t.last_inbound_at?new Date(t.last_inbound_at).toLocaleString():'No inbound timestamp'}</p></div><select value={t.status} onChange={e=>void change(t.id,e.target.value)} className="rounded bg-slate-800 p-2">{['open','waiting_agent','waiting_customer','resolved','blocked','spam'].map(x=><option key={x}>{x}</option>)}</select></div><div className="mt-3 space-y-2">{t.recent_events.slice(0,5).map(e=><div key={e.id} className="rounded bg-slate-950 p-2 text-sm"><b>{e.direction} · {e.type}</b>{e.text&&<span className="ml-2 text-slate-300">{e.text}</span>}</div>)}</div></article>)}{!threads.length&&!error&&<div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400">No real provider events received yet. Connect a provider webhook to the authenticated integration event API.</div>}</section>
 </div></main>;
}
