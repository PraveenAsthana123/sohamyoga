'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
type Report = { id: string; report_type: string; title: string; customer_name: string; status: string; updated_at: string };
export default function MeetingReportsPage() {
  const [reports,setReports]=useState<Report[]>([]); const [message,setMessage]=useState('');
  const load=useCallback(async()=>{const r=await fetch('/api/meeting-reports',{cache:'no-store'});const d=await r.json();setReports(d.reports??[]);},[]);
  useEffect(()=>{void load();},[load]);
  async function create(event:FormEvent<HTMLFormElement>){event.preventDefault();setMessage('Creating…');const form=event.currentTarget;
    const response=await fetch('/api/meeting-reports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    const result=await response.json();setMessage(response.ok?'Report draft created with an audit event.':result.error??'Creation failed.');if(response.ok){form.reset();await load();}}
  return <main className="space-y-6 p-6"><div><h1 className="text-2xl font-bold">Meeting Reports</h1><p className="text-sm text-gray-500">Evidence-aware pre-meeting briefs and post-meeting reports. Draft text is never presented as validated research.</p></div>
    <form onSubmit={create} className="grid gap-3 rounded border bg-white p-4 md:grid-cols-2"><select name="reportType" required className="rounded border p-2"><option value="pre_meeting_brief">Short pre-meeting brief</option><option value="post_meeting_report">Long post-meeting report</option></select><input name="customerName" required maxLength={200} placeholder="Customer or account" className="rounded border p-2"/><input name="title" required maxLength={240} placeholder="Report title" className="rounded border p-2"/><input name="meetingAt" type="datetime-local" className="rounded border p-2"/><textarea name="objective" maxLength={4000} placeholder="Meeting objective" className="rounded border p-2 md:col-span-2"/><button className="rounded bg-brand-600 px-4 py-2 text-white">Create auditable draft</button><span className="self-center text-sm">{message}</span></form>
    <section className="overflow-hidden rounded border bg-white"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="p-3">Title</th><th>Customer</th><th>Template</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>{reports.map(r=><tr key={r.id} className="border-t"><td className="p-3 font-medium">{r.title}</td><td>{r.customer_name}</td><td>{r.report_type==='pre_meeting_brief'?'Pre-meeting':'Post-meeting'}</td><td>{r.status}</td><td>{new Date(r.updated_at).toLocaleString()}</td><td className="p-3"><Link href={`/meeting-reports/${r.id}`} className="text-brand-600 hover:underline">Open →</Link></td></tr>)}</tbody></table>{!reports.length&&<p className="p-4 text-sm text-gray-500">No reports yet.</p>}</section></main>;
}
