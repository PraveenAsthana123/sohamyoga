'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'Event Command' | 'Venue & Site Inspection' | 'Attendee Database' | 'Logistics' | 'Gamification' | 'Emergency & Awards';
const TABS: Tab[] = ['Event Command', 'Venue & Site Inspection', 'Attendee Database', 'Logistics', 'Gamification', 'Emergency & Awards'];

interface Venue { id: number; event_name: string; venue_name: string; address: string; capacity: number; inspection_status: string; approved: boolean; registered?: number; checked_in?: number; capacity_used_pct?: number; check_in_rate_pct?: number; gamification_completions?: number; }
interface Attendee { id: number; event_name: string; name: string; email: string; company: string; badge_type: string; checked_in: boolean; lead_score: number; }
interface LogisticsItem { id: number; event_name: string; category: string; item_name: string; quantity: number; supplier: string; cost: number; status: string; delivery_date: string; }
interface GameChallenge { id: number; event_name: string; challenge_name: string; points: number; completions: number; badge_name: string; status: string; }
interface EmergencyPlan { id: number; event_name: string; scenario: string; response_steps: string[]; responsible_person: string; contact: string; }
interface Award { id: number; event_name: string; category: string; winner_name: string; runner_up: string; presented_by: string; }

const STATUS_COLOR: Record<string, string> = { approved: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700', in_progress: 'bg-blue-100 text-blue-700', confirmed: 'bg-green-100 text-green-700', ordered: 'bg-blue-100 text-blue-700', general: 'bg-gray-100 text-gray-700', VIP: 'bg-purple-100 text-purple-700', speaker: 'bg-blue-100 text-blue-700', sponsor: 'bg-gold-100 text-yellow-700' };
const EVENTS = ['Yoga Summit 2026', 'Corporate Wellness Day'];

export default function EventLogisticsPage() {
  const [tab, setTab] = useState<Tab>('Event Command');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [items, setItems] = useState<LogisticsItem[]>([]);
  const [challenges, setChallenges] = useState<GameChallenge[]>([]);
  const [emergencyPlans, setEmergencyPlans] = useState<EmergencyPlan[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [capacityReport, setCapacityReport] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(EVENTS[0]);
  const [emergencyForm, setEmergencyForm] = useState({ scenario: 'medical', event_name: EVENTS[0], venue: 'Main Venue', capacity: '350' });
  const [generatedPlan, setGeneratedPlan] = useState<Record<string, unknown> | null>(null);

  const loadData = useCallback(async () => {
    const [vRes, iRes, gRes, eRes, aRes, cRes] = await Promise.all([
      fetch('/api/admin/event-logistics'),
      fetch('/api/admin/event-logistics/items'),
      fetch('/api/admin/event-logistics/gamification'),
      fetch('/api/admin/event-logistics/emergency'),
      fetch('/api/admin/event-logistics/awards'),
      fetch('/api/admin/event-logistics/capacity'),
    ]);
    if (vRes.ok) setVenues(await vRes.json() as Venue[]);
    if (iRes.ok) setItems(await iRes.json() as LogisticsItem[]);
    if (gRes.ok) setChallenges(await gRes.json() as GameChallenge[]);
    if (eRes.ok) setEmergencyPlans(await eRes.json() as EmergencyPlan[]);
    if (aRes.ok) setAwards(await aRes.json() as Award[]);
    if (cRes.ok) setCapacityReport(await cRes.json() as Venue[]);
  }, []);

  const loadAttendees = useCallback(async (eventName: string) => {
    const res = await fetch(`/api/admin/event-logistics/${encodeURIComponent(eventName)}/attendees`);
    if (res.ok) setAttendees(await res.json() as Attendee[]);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadAttendees(selectedEvent); }, [selectedEvent, loadAttendees]);

  const checkIn = async (id: number) => {
    await fetch(`/api/admin/event-logistics/${encodeURIComponent(selectedEvent)}/attendees/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) });
    await loadAttendees(selectedEvent);
    await loadData();
  };

  const generateEmergencyPlan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/event-logistics/emergency/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(emergencyForm) });
      setGeneratedPlan(await res.json() as Record<string, unknown>);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Event Logistics</h1>
        <p className="text-slate-300 text-sm">Venue inspection, capacity planning, attendee management, gamification & emergency planning</p>
      </div>

      <div className="bg-white border-b px-6 py-3 flex gap-8">
        {capacityReport.map(r => (
          <div key={r.event_name}>
            <span className="text-2xl font-bold text-slate-800">{r.check_in_rate_pct || 0}%</span>
            <span className="text-gray-500 text-sm ml-1">{r.event_name} Check-in</span>
          </div>
        ))}
        <div><span className="text-2xl font-bold text-slate-800">{challenges.reduce((s, c) => s + c.completions, 0)}</span><span className="text-gray-500 text-sm ml-1">Game Completions</span></div>
        <div><span className="text-2xl font-bold text-slate-800">{items.reduce((s, i) => s + Number(i.cost), 0).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}</span><span className="text-gray-500 text-sm ml-1">Logistics Budget</span></div>
      </div>

      <div className="bg-white border-b px-6 flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* Event Command */}
        {tab === 'Event Command' && (
          <div className="grid grid-cols-2 gap-6">
            {capacityReport.map(r => (
              <div key={r.event_name} className="bg-white rounded-lg border p-6">
                <h2 className="font-bold text-lg text-slate-800 mb-4">{r.event_name}</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-50 rounded p-3 text-center"><p className="text-xs text-gray-500">Registered</p><p className="text-2xl font-bold text-blue-700">{r.registered}</p></div>
                  <div className="bg-green-50 rounded p-3 text-center"><p className="text-xs text-gray-500">Checked In</p><p className="text-2xl font-bold text-green-700">{r.checked_in}</p></div>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Check-in Progress</span><span>{r.check_in_rate_pct}%</span></div>
                  <div className="bg-gray-200 rounded-full h-4"><div className="bg-green-500 h-4 rounded-full" style={{ width: `${r.check_in_rate_pct || 0}%` }} /></div>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Capacity Used</span><span>{r.capacity_used_pct}% of {r.capacity}</span></div>
                  <div className="bg-gray-200 rounded-full h-3"><div className={`h-3 rounded-full ${(r.capacity_used_pct || 0) > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(r.capacity_used_pct || 0, 100)}%` }} /></div>
                </div>
                {challenges.filter(c => c.event_name === r.event_name).length > 0 && (
                  <div className="bg-purple-50 rounded p-3">
                    <p className="text-xs font-bold text-purple-800 mb-2">Gamification Leaderboard</p>
                    {challenges.filter(c => c.event_name === r.event_name).map(c => (
                      <div key={c.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                        <span>{c.challenge_name}</span><span className="font-bold">{c.completions} completions</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Venue & Site Inspection */}
        {tab === 'Venue & Site Inspection' && (
          <div className="space-y-4">
            {venues.map(v => (
              <div key={v.id} className="bg-white rounded-lg border p-5">
                <div className="flex justify-between items-start">
                  <div><h3 className="font-bold text-lg">{v.event_name}</h3>
                    <p className="font-medium text-gray-700">{v.venue_name}</p>
                    <p className="text-sm text-gray-500">{v.address}</p>
                    <p className="text-sm text-gray-500 mt-1">Capacity: {v.capacity} people</p></div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_COLOR[v.inspection_status] || 'bg-gray-100'}`}>{v.inspection_status}</span>
                    {v.approved && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">✓ Approved</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Attendee Database */}
        {tab === 'Attendee Database' && (
          <div>
            <div className="flex gap-4 mb-4 items-center">
              <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="border rounded px-3 py-2 text-sm">
                {EVENTS.map(e => <option key={e}>{e}</option>)}
              </select>
              <span className="text-sm text-gray-500">{attendees.length} total · {attendees.filter(a => a.checked_in).length} checked in</span>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Name','Company','Badge','Lead Score','Check-in'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                <tbody>{attendees.map(a => (
                  <tr key={a.id} className={`border-t hover:bg-gray-50 ${a.checked_in ? 'bg-green-50' : ''}`}>
                    <td className="px-4 py-3"><p className="font-medium">{a.name}</p><p className="text-xs text-gray-400">{a.email}</p></td>
                    <td className="px-4 py-3 text-gray-700">{a.company}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[a.badge_type] || 'bg-gray-100'}`}>{a.badge_type}</span></td>
                    <td className="px-4 py-3 font-bold text-blue-700">{a.lead_score}</td>
                    <td className="px-4 py-3">
                      {a.checked_in ? <span className="text-xs text-green-700 font-medium">✓ Checked in</span>
                        : <button onClick={() => checkIn(a.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Check In</button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* Logistics */}
        {tab === 'Logistics' && (
          <div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {['Furniture','AV','Catering','Technology'].map(cat => {
                const catItems = items.filter(i => i.category === cat);
                const total = catItems.reduce((s, i) => s + Number(i.cost), 0);
                return <div key={cat} className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">{cat}</p><p className="text-xl font-bold">${total.toLocaleString()}</p><p className="text-xs text-gray-400">{catItems.length} items</p></div>;
              })}
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Event','Category','Item','Qty','Supplier','Cost','Status','Delivery'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                <tbody>{items.map(i => (
                  <tr key={i.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">{i.event_name}</td>
                    <td className="px-4 py-3 text-xs">{i.category}</td>
                    <td className="px-4 py-3 font-medium">{i.item_name}</td>
                    <td className="px-4 py-3">{i.quantity}</td>
                    <td className="px-4 py-3 text-gray-600">{i.supplier}</td>
                    <td className="px-4 py-3 font-bold">${Number(i.cost).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[i.status] || 'bg-gray-100'}`}>{i.status}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{i.delivery_date}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* Gamification */}
        {tab === 'Gamification' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Active Challenges</h2>
              <div className="space-y-3">
                {challenges.map(c => (
                  <div key={c.id} className="border rounded p-4">
                    <div className="flex justify-between items-center">
                      <div><p className="font-medium">{c.challenge_name}</p>
                        <p className="text-xs text-gray-500">{c.event_name} · Badge: {c.badge_name}</p></div>
                      <div className="text-right"><p className="text-xl font-bold text-purple-700">{c.points} pts</p><p className="text-xs text-gray-500">{c.completions} done</p></div>
                    </div>
                    <div className="mt-2 bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min((c.completions / 400) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Leaderboard by Event</h2>
              {EVENTS.map(ev => (
                <div key={ev} className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">{ev}</h3>
                  {challenges.filter(c => c.event_name === ev).sort((a, b) => b.completions - a.completions).map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <span className={`text-sm font-bold w-6 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-orange-500'}`}>{i + 1}</span>
                      <div className="flex-1"><p className="text-xs font-medium">{c.challenge_name}</p></div>
                      <span className="text-sm font-bold text-purple-700">{c.completions}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emergency & Awards */}
        {tab === 'Emergency & Awards' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-white rounded-lg border p-5">
                <h2 className="font-semibold text-slate-800 mb-4">Emergency Plan Generator</h2>
                <div className="space-y-3">
                  <div><label className="text-xs font-medium text-gray-600">Scenario</label>
                    <select value={emergencyForm.scenario} onChange={e => setEmergencyForm(p => ({ ...p, scenario: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm">
                      {['medical','fire','security','weather'].map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><label className="text-xs font-medium text-gray-600">Event Name</label>
                    <select value={emergencyForm.event_name} onChange={e => setEmergencyForm(p => ({ ...p, event_name: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm">
                      {EVENTS.map(e => <option key={e}>{e}</option>)}</select></div>
                  <button onClick={generateEmergencyPlan} disabled={loading}
                    className="w-full bg-red-600 text-white py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                    {loading ? 'Generating...' : '🚨 Generate Emergency Plan'}
                  </button>
                </div>
                {generatedPlan && (
                  <div className="mt-4 bg-red-50 rounded p-3 border border-red-200">
                    <p className="text-xs font-bold text-red-800 mb-2 uppercase">{String(generatedPlan.scenario)} Response Plan</p>
                    <ol className="space-y-1">{(generatedPlan.response_steps as string[]).map((s, i) => <li key={i} className="text-xs text-gray-700">{i + 1}. {s}</li>)}</ol>
                    <p className="text-xs text-gray-600 mt-2"><strong>Protocol:</strong> {String(generatedPlan.communication_protocol)}</p>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-lg border p-5">
                <h2 className="font-semibold text-slate-800 mb-4">Existing Emergency Plans</h2>
                {emergencyPlans.map(p => (
                  <div key={p.id} className="border rounded p-3 mb-2">
                    <div className="flex justify-between"><p className="font-medium text-sm capitalize">{p.scenario}</p><span className="text-xs text-gray-400">{p.event_name}</span></div>
                    <p className="text-xs text-gray-500">Lead: {p.responsible_person} · {p.contact}</p>
                    <p className="text-xs text-gray-600 mt-1">{(p.response_steps || []).length} response steps</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Award Ceremonies</h2>
              <div className="space-y-3">
                {awards.map(a => (
                  <div key={a.id} className="border rounded p-4 bg-yellow-50 border-yellow-200">
                    <p className="text-xs text-yellow-700 font-medium">{a.event_name}</p>
                    <p className="font-bold text-slate-800">{a.category}</p>
                    <div className="mt-2 flex justify-between">
                      <div><p className="text-xs text-gray-500">Winner</p><p className="font-medium text-sm text-yellow-700">🏆 {a.winner_name}</p></div>
                      {a.runner_up && <div className="text-right"><p className="text-xs text-gray-500">Runner-up</p><p className="text-sm">🥈 {a.runner_up}</p></div>}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Presented by: {a.presented_by}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
