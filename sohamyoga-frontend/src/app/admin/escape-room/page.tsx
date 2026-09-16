'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','bookings','rooms','results','promos','ai-gm'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = {
  dashboard: 'Dashboard', bookings: 'Bookings', rooms: 'Rooms',
  results: 'Game Results', promos: 'Promotions', 'ai-gm': 'AI Game Master',
};

const DIFFICULTIES = ['easy','medium','hard','extreme'];
const GROUP_TYPES = ['friends','corporate','birthday','date_night','family','team_building','other'];
const BOOKING_STATUSES = ['booked','confirmed','checked_in','playing','completed','cancelled','no_show'];

interface Room { id:number; room_name:string; theme:string; description:string; difficulty:string; min_players:number; max_players:number; duration_minutes:number; price_per_person:number; is_active:boolean; success_rate_pct:number; total_plays:number; }
interface Booking { id:number; room_id:number; room_name:string; theme:string; customer_name:string; customer_email:string; customer_phone:string; booking_date:string; start_time:string; player_count:number; total_amount:number; deposit_paid:number; balance_due:number; promo_code:string; status:string; group_type:string; waiver_signed:boolean; notes:string; }
interface GameResult { id:number; room_name:string; customer_name:string; escaped:boolean; time_taken_minutes:number; hints_used:number; player_count:number; customer_rating:number; game_master:string; created_at:string; }
interface Promo { id:number; code:string; description:string; discount_type:string; discount_value:number; valid_from:string; valid_until:string; max_uses:number; current_uses:number; is_active:boolean; }
interface DashData { bookings_today:number; players_today:number; escape_rate_today:number; revenue_today:number; rooms_active:number; }

function fmtDate(d:string){ return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtTime(t:string){ if(!t) return '—'; const [h,m]=t.split(':'); const hr=parseInt(h); return `${hr%12||12}:${m} ${hr>=12?'PM':'AM'}`; }
function fmtCad(n:number){ return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:0})}`; }

function Badge({ label, color='gray' }: { label:string; color?:string }) {
  const m:Record<string,string>={blue:'bg-blue-100 text-blue-700',green:'bg-green-100 text-green-700',amber:'bg-amber-100 text-amber-700',red:'bg-red-100 text-red-700',purple:'bg-purple-100 text-purple-700',gray:'bg-gray-100 text-gray-700',teal:'bg-teal-100 text-teal-700',orange:'bg-orange-100 text-orange-700'};
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label}</span>;
}
function KpiCard({ label, value, sub, color='blue' }: { label:string; value:string|number; sub?:string; color?:string }) {
  const b:Record<string,string>={blue:'border-l-4 border-blue-500 bg-blue-50',green:'border-l-4 border-green-500 bg-green-50',amber:'border-l-4 border-amber-500 bg-amber-50',red:'border-l-4 border-red-500 bg-red-50',purple:'border-l-4 border-purple-500 bg-purple-50'};
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function diffColor(d:string){ const m:Record<string,string>={easy:'green',medium:'amber',hard:'red',extreme:'purple'}; return m[d]??'gray'; }
function statusColor(s:string){ const m:Record<string,string>={booked:'blue',confirmed:'teal',checked_in:'purple',playing:'green',completed:'gray',cancelled:'red',no_show:'amber'}; return m[s]??'gray'; }

// ─── Add Room Modal ───────────────────────────────────────────────────────────
function AddRoomModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState({ room_name:'',theme:'',description:'',difficulty:'medium',min_players:'2',max_players:'8',duration_minutes:'60',price_per_person:'',min_booking_amount:'' });
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.room_name||!form.price_per_person) return;
    setSaving(true);
    try{
      await fetch('/api/admin/escape-room/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,min_players:parseInt(form.min_players),max_players:parseInt(form.max_players),duration_minutes:parseInt(form.duration_minutes),price_per_person:parseFloat(form.price_per_person),min_booking_amount:form.min_booking_amount?parseFloat(form.min_booking_amount):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-6 border-b"><h2 className="text-xl font-bold">Add Room</h2></div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="text-xs text-gray-500">Room Name *</label><input className="w-full border rounded p-2 mt-1" value={form.room_name} onChange={e=>f('room_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Theme</label><input className="w-full border rounded p-2 mt-1" value={form.theme} onChange={e=>f('theme',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Difficulty</label><select className="w-full border rounded p-2 mt-1" value={form.difficulty} onChange={e=>f('difficulty',e.target.value)}>{DIFFICULTIES.map(d=><option key={d}>{d}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Min Players</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.min_players} onChange={e=>f('min_players',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Max Players</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.max_players} onChange={e=>f('max_players',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Duration (min)</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.duration_minutes} onChange={e=>f('duration_minutes',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Price/Person ($) *</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.price_per_person} onChange={e=>f('price_per_person',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded p-2 mt-1 h-20" value={form.description} onChange={e=>f('description',e.target.value)}/></div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving?'Saving...':'Add Room'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Booking Modal ────────────────────────────────────────────────────────
function AddBookingModal({ rooms, onClose, onSaved }: { rooms:Room[]; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState({ room_id:'',customer_name:'',customer_email:'',customer_phone:'',booking_date:'',start_time:'',player_count:'4',promo_code:'',group_type:'friends',notes:'' });
  const [saving,setSaving]=useState(false);
  const [promoResult,setPromoResult]=useState<{valid:boolean;discount?:number;type?:string}|null>(null);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));

  const selectedRoom = rooms.find(r=>r.id===parseInt(form.room_id));
  const playerCount = parseInt(form.player_count)||0;
  const baseAmount = selectedRoom ? selectedRoom.price_per_person * playerCount : 0;
  const discountAmt = promoResult?.valid ? (promoResult.type==='percentage' ? baseAmount * (promoResult.discount||0)/100 : promoResult.discount||0) : 0;
  const totalAmount = Math.max(0, baseAmount - discountAmt);

  async function validatePromo(){ if(!form.promo_code) return; const r=await fetch('/api/admin/escape-room/promos/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:form.promo_code})}); const d=await r.json(); setPromoResult(d.valid?{valid:true,discount:d.promo.discount_value,type:d.promo.discount_type}:{valid:false}); }

  async function submit(){
    if(!form.room_id||!form.customer_name||!form.customer_phone||!form.booking_date||!form.start_time) return;
    setSaving(true);
    try{
      const r=await fetch('/api/admin/escape-room/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,room_id:parseInt(form.room_id),player_count:playerCount,total_amount:totalAmount,balance_due:totalAmount,discount_pct:promoResult?.valid&&promoResult.type==='percentage'?promoResult.discount:0})});
      if(!r.ok){const d=await r.json();alert(d.error);return;}
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b"><h2 className="text-xl font-bold">Add Booking</h2></div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="text-xs text-gray-500">Room *</label><select className="w-full border rounded p-2 mt-1" value={form.room_id} onChange={e=>f('room_id',e.target.value)}><option value="">Select room...</option>{rooms.filter(r=>r.is_active).map(r=><option key={r.id} value={r.id}>{r.room_name} ({r.difficulty}) — {fmtCad(r.price_per_person)}/person</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Customer Name *</label><input className="w-full border rounded p-2 mt-1" value={form.customer_name} onChange={e=>f('customer_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded p-2 mt-1" value={form.customer_phone} onChange={e=>f('customer_phone',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded p-2 mt-1" value={form.customer_email} onChange={e=>f('customer_email',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Group Type</label><select className="w-full border rounded p-2 mt-1" value={form.group_type} onChange={e=>f('group_type',e.target.value)}>{GROUP_TYPES.map(g=><option key={g}>{g}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="w-full border rounded p-2 mt-1" value={form.booking_date} onChange={e=>f('booking_date',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Start Time *</label><input type="time" className="w-full border rounded p-2 mt-1" value={form.start_time} onChange={e=>f('start_time',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Players *</label><input type="number" className="w-full border rounded p-2 mt-1" min={selectedRoom?.min_players||2} max={selectedRoom?.max_players||8} value={form.player_count} onChange={e=>f('player_count',e.target.value)}/>{selectedRoom&&<p className="text-xs text-gray-400 mt-1">{selectedRoom.min_players}–{selectedRoom.max_players} players</p>}</div>
          <div><label className="text-xs text-gray-500">Promo Code</label><div className="flex gap-2 mt-1"><input className="flex-1 border rounded p-2" value={form.promo_code} onChange={e=>f('promo_code',e.target.value.toUpperCase())}/><button onClick={validatePromo} className="px-3 py-2 bg-gray-100 rounded text-sm">Apply</button></div>
            {promoResult!==null&&<p className={`text-xs mt-1 ${promoResult.valid?'text-green-600':'text-red-500'}`}>{promoResult.valid?`Discount: ${promoResult.type==='percentage'?promoResult.discount+'%':fmtCad(promoResult.discount||0)}`:'Invalid code'}</p>}
          </div>
          {selectedRoom&&<div className="col-span-2 bg-blue-50 rounded-lg p-3"><p className="text-sm font-medium">Base: {fmtCad(baseAmount)}{discountAmt>0&&<> — Discount: {fmtCad(discountAmt)}</>} = <strong>Total: {fmtCad(totalAmount)}</strong></p></div>}
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving?'Saving...':'Book'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Game Modal ──────────────────────────────────────────────────────
function CompleteGameModal({ booking, onClose, onSaved }: { booking:Booking; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState({ escaped:'true',time_taken_minutes:'',hints_used:'0',game_master:'',customer_rating:'5',customer_feedback:'' });
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    setSaving(true);
    try{
      await fetch(`/api/admin/escape-room/bookings/${booking.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({escaped:form.escaped==='true',time_taken_minutes:form.time_taken_minutes?parseInt(form.time_taken_minutes):null,hints_used:parseInt(form.hints_used),game_master:form.game_master,customer_rating:parseInt(form.customer_rating)||null,customer_feedback:form.customer_feedback})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="p-6 border-b"><h2 className="text-xl font-bold">Complete Game</h2><p className="text-sm text-gray-500 mt-1">{booking.customer_name} · {booking.room_name}</p></div>
        <div className="p-6 space-y-4">
          <div><label className="text-xs text-gray-500">Result</label><div className="flex gap-3 mt-1"><button onClick={()=>f('escaped','true')} className={`flex-1 py-2 rounded font-medium text-sm ${form.escaped==='true'?'bg-green-600 text-white':'border'}`}>ESCAPED</button><button onClick={()=>f('escaped','false')} className={`flex-1 py-2 rounded font-medium text-sm ${form.escaped==='false'?'bg-red-600 text-white':'border'}`}>FAILED</button></div></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Time (minutes)</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.time_taken_minutes} onChange={e=>f('time_taken_minutes',e.target.value)}/></div>
            <div><label className="text-xs text-gray-500">Hints Used</label><input type="number" min="0" className="w-full border rounded p-2 mt-1" value={form.hints_used} onChange={e=>f('hints_used',e.target.value)}/></div>
          </div>
          <div><label className="text-xs text-gray-500">Game Master</label><input className="w-full border rounded p-2 mt-1" value={form.game_master} onChange={e=>f('game_master',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Customer Rating (1–5)</label><input type="number" min="1" max="5" className="w-full border rounded p-2 mt-1" value={form.customer_rating} onChange={e=>f('customer_rating',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Feedback</label><textarea className="w-full border rounded p-2 mt-1 h-16" value={form.customer_feedback} onChange={e=>f('customer_feedback',e.target.value)}/></div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">{saving?'Saving...':'Complete Game'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Promo Modal ──────────────────────────────────────────────────────────
function AddPromoModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState({ code:'',description:'',discount_type:'percentage',discount_value:'',valid_from:'',valid_until:'',max_uses:'' });
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.code||!form.discount_value) return;
    setSaving(true);
    try{
      await fetch('/api/admin/escape-room/promos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,code:form.code.toUpperCase(),discount_value:parseFloat(form.discount_value),max_uses:form.max_uses?parseInt(form.max_uses):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="p-6 border-b"><h2 className="text-xl font-bold">Add Promo Code</h2></div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500">Code *</label><input className="w-full border rounded p-2 mt-1 uppercase" value={form.code} onChange={e=>f('code',e.target.value.toUpperCase())}/></div>
          <div><label className="text-xs text-gray-500">Type</label><select className="w-full border rounded p-2 mt-1" value={form.discount_type} onChange={e=>f('discount_type',e.target.value)}><option value="percentage">Percentage</option><option value="fixed_amount">Fixed Amount</option></select></div>
          <div><label className="text-xs text-gray-500">Value *</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.discount_value} onChange={e=>f('discount_value',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Max Uses</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.max_uses} onChange={e=>f('max_uses',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Valid From</label><input type="date" className="w-full border rounded p-2 mt-1" value={form.valid_from} onChange={e=>f('valid_from',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Valid Until</label><input type="date" className="w-full border rounded p-2 mt-1" value={form.valid_until} onChange={e=>f('valid_until',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description</label><input className="w-full border rounded p-2 mt-1" value={form.description} onChange={e=>f('description',e.target.value)}/></div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving?'Saving...':'Create'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EscapeRoomPage() {
  const [tab,setTab]=useState<Tab>('dashboard');
  const [dash,setDash]=useState<DashData|null>(null);
  const [rooms,setRooms]=useState<Room[]>([]);
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [results,setResults]=useState<GameResult[]>([]);
  const [promos,setPromos]=useState<Promo[]>([]);
  const [loading,setLoading]=useState(false);

  const [dateFilter,setDateFilter]=useState(new Date().toISOString().split('T')[0]);
  const [roomFilter,setRoomFilter]=useState('');

  const [showAddRoom,setShowAddRoom]=useState(false);
  const [showAddBooking,setShowAddBooking]=useState(false);
  const [showAddPromo,setShowAddPromo]=useState(false);
  const [completeBooking,setCompleteBooking]=useState<Booking|null>(null);

  // AI GM
  const [gmForm,setGmForm]=useState({ room_id:'',group_type:'friends',player_count:'4' });
  const [gmScript,setGmScript]=useState('');
  const [gmLoading,setGmLoading]=useState(false);

  const loadDash=useCallback(async()=>{ const r=await fetch('/api/admin/escape-room'); if(r.ok){const d=await r.json();setDash(d);} },[]);
  const loadRooms=useCallback(async()=>{ const r=await fetch('/api/admin/escape-room/rooms'); if(r.ok){const d=await r.json();setRooms(d.rooms);} },[]);
  const loadBookings=useCallback(async()=>{ setLoading(true); try{ const p=new URLSearchParams(); if(dateFilter)p.set('date',dateFilter); if(roomFilter)p.set('room_id',roomFilter); const r=await fetch('/api/admin/escape-room/bookings?'+p); if(r.ok){const d=await r.json();setBookings(d.bookings);} }finally{setLoading(false);} },[dateFilter,roomFilter]);
  const loadResults=useCallback(async()=>{ const r=await fetch('/api/admin/escape-room/game-results'); if(r.ok){const d=await r.json();setResults(d.results);} },[]);
  const loadPromos=useCallback(async()=>{ const r=await fetch('/api/admin/escape-room/promos'); if(r.ok){const d=await r.json();setPromos(d.promos);} },[]);

  useEffect(()=>{ loadDash(); loadRooms(); },[loadDash,loadRooms]);
  useEffect(()=>{ if(tab==='bookings') loadBookings(); if(tab==='results') loadResults(); if(tab==='promos') loadPromos(); },[tab,loadBookings,loadResults,loadPromos]);

  async function patchBooking(id:number, body:object){ await fetch(`/api/admin/escape-room/bookings/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); loadBookings(); }
  async function startGame(id:number){ await fetch(`/api/admin/escape-room/bookings/${id}/start`,{method:'POST'}); loadBookings(); }

  const selectedRoom=rooms.find(r=>r.id===parseInt(gmForm.room_id));
  async function genGmScript(){ if(!gmForm.room_id||!selectedRoom) return; setGmLoading(true); try{ const r=await fetch('/api/admin/escape-room/ai-gm-script',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room_name:selectedRoom.room_name,theme:selectedRoom.theme,difficulty:selectedRoom.difficulty,...gmForm,player_count:parseInt(gmForm.player_count)})}); if(r.ok){const d=await r.json();setGmScript(d.script);} }finally{setGmLoading(false);} }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Escape Room & Entertainment Venue Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Bookings, game results, room management, promotions, and AI game master scripts</p>
      </div>

      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab===t?'border-purple-500 text-purple-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab==='dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-5 gap-4">
              <KpiCard label="Bookings Today" value={dash?.bookings_today??'—'} color="blue"/>
              <KpiCard label="Players Today" value={dash?.players_today??'—'} color="green"/>
              <KpiCard label="Escape Rate Today" value={`${dash?.escape_rate_today??0}%`} color="purple"/>
              <KpiCard label="Revenue Today" value={fmtCad(dash?.revenue_today??0)} color="green"/>
              <KpiCard label="Active Rooms" value={dash?.rooms_active??'—'} color="amber"/>
            </div>
            {/* Room status grid */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Room Status</h3>
              <div className="grid grid-cols-4 gap-4">
                {rooms.map(r=>(
                  <div key={r.id} className={`rounded-lg border-2 p-4 ${r.is_active?'border-green-200 bg-green-50':'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">{r.room_name}</p>
                      <Badge label={r.difficulty} color={diffColor(r.difficulty)}/>
                    </div>
                    <p className="text-xs text-gray-500">{r.theme}</p>
                    <p className="text-xs text-gray-400 mt-1">{r.duration_minutes}min · {r.min_players}–{r.max_players} players</p>
                    <p className="text-sm font-bold text-gray-700 mt-2">{fmtCad(r.price_per_person)}/person</p>
                    {r.success_rate_pct!==null&&<p className="text-xs text-gray-500 mt-1">Escape rate: {r.success_rate_pct}%</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BOOKINGS */}
        {tab==='bookings' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <input type="date" className="border rounded p-2 text-sm" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/>
              <select className="border rounded p-2 text-sm" value={roomFilter} onChange={e=>setRoomFilter(e.target.value)}>
                <option value="">All Rooms</option>
                {rooms.map(r=><option key={r.id} value={r.id}>{r.room_name}</option>)}
              </select>
              <button onClick={loadBookings} className="px-3 py-2 bg-gray-100 rounded text-sm">Filter</button>
              <div className="flex-1"/>
              <button onClick={()=>setShowAddBooking(true)} className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium">+ Add Booking</button>
            </div>

            {loading ? <p className="text-gray-400">Loading...</p> : (
              <div className="space-y-2">
                {bookings.map(b=>(
                  <div key={b.id} className="bg-white rounded-xl border p-4 flex items-center gap-4">
                    <div className="w-28 text-center bg-purple-50 rounded-lg p-2">
                      <p className="text-xs text-gray-500">{fmtDate(b.booking_date)}</p>
                      <p className="font-bold text-sm text-purple-700">{fmtTime(b.start_time)}</p>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{b.customer_name} <span className="text-gray-400 text-sm">({b.player_count} players)</span></p>
                      <p className="text-sm text-gray-500">{b.room_name} · {b.group_type} · {fmtCad(b.total_amount)}</p>
                      {b.promo_code&&<p className="text-xs text-green-600">Promo: {b.promo_code}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge label={b.status} color={statusColor(b.status)}/>
                      {b.waiver_signed&&<Badge label="Waiver" color="green"/>}
                    </div>
                    <div className="flex gap-2">
                      {b.status==='booked'&&<button onClick={()=>patchBooking(b.id,{status:'confirmed'})} className="px-2 py-1 bg-teal-600 text-white rounded text-xs">Confirm</button>}
                      {b.status==='confirmed'&&<button onClick={()=>patchBooking(b.id,{status:'checked_in'})} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Check In</button>}
                      {b.status==='checked_in'&&<button onClick={()=>startGame(b.id)} className="px-2 py-1 bg-green-600 text-white rounded text-xs">Start Game</button>}
                      {b.status==='playing'&&<button onClick={()=>setCompleteBooking(b)} className="px-2 py-1 bg-purple-600 text-white rounded text-xs">Complete</button>}
                      {['booked','confirmed'].includes(b.status)&&<button onClick={()=>patchBooking(b.id,{status:'no_show'})} className="px-2 py-1 bg-amber-500 text-white rounded text-xs">No Show</button>}
                      {!['completed','cancelled','no_show'].includes(b.status)&&<button onClick={()=>patchBooking(b.id,{status:'cancelled'})} className="px-2 py-1 bg-red-500 text-white rounded text-xs">Cancel</button>}
                    </div>
                  </div>
                ))}
                {!bookings.length&&<p className="text-center py-8 text-gray-400">No bookings for selected filters</p>}
              </div>
            )}
          </div>
        )}

        {/* ROOMS */}
        {tab==='rooms' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={()=>setShowAddRoom(true)} className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium">+ Add Room</button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {rooms.map(r=>(
                <div key={r.id} className={`bg-white rounded-xl border p-5 ${!r.is_active?'opacity-60':''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-800">{r.room_name}</h3>
                      <p className="text-sm text-gray-500">{r.theme}</p>
                    </div>
                    <Badge label={r.difficulty} color={diffColor(r.difficulty)}/>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{r.description}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">Players:</span> {r.min_players}–{r.max_players}</div>
                    <div><span className="text-gray-500">Duration:</span> {r.duration_minutes}min</div>
                    <div><span className="text-gray-500">Price:</span> {fmtCad(r.price_per_person)}/person</div>
                    <div><span className="text-gray-500">Escape Rate:</span> {r.success_rate_pct??'N/A'}{r.success_rate_pct!==null&&r.success_rate_pct!==undefined?'%':''}</div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-400">{r.total_plays} plays</p>
                    <button onClick={async()=>{ await fetch(`/api/admin/escape-room/rooms/${r.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_active:!r.is_active})}); loadRooms(); }}
                      className={`px-3 py-1 rounded text-xs font-medium ${r.is_active?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>
                      {r.is_active?'Deactivate':'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GAME RESULTS */}
        {tab==='results' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Room','Customer','Result','Time','Hints','Players','Rating','Date'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {results.map(r=>(
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{r.room_name}</td>
                      <td className="px-4 py-3">{r.customer_name}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${r.escaped?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{r.escaped?'ESCAPED':'FAILED'}</span></td>
                      <td className="px-4 py-3">{r.time_taken_minutes?`${r.time_taken_minutes}min`:'—'}</td>
                      <td className="px-4 py-3">{r.hints_used}</td>
                      <td className="px-4 py-3">{r.player_count}</td>
                      <td className="px-4 py-3">{r.customer_rating?'★'.repeat(r.customer_rating)+'☆'.repeat(5-r.customer_rating):'—'}</td>
                      <td className="px-4 py-3">{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!results.length&&<p className="text-center py-8 text-gray-400">No game results yet</p>}
            </div>
          </div>
        )}

        {/* PROMOTIONS */}
        {tab==='promos' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={()=>setShowAddPromo(true)} className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium">+ Add Promo Code</button>
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Code','Description','Discount','Valid Period','Usage','Status'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {promos.map(p=>(
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-bold text-purple-700">{p.code}</td>
                      <td className="px-4 py-3">{p.description||'—'}</td>
                      <td className="px-4 py-3">{p.discount_type==='percentage'?`${p.discount_value}%`:fmtCad(p.discount_value)}</td>
                      <td className="px-4 py-3">{p.valid_from?fmtDate(p.valid_from):'Any'} – {p.valid_until?fmtDate(p.valid_until):'Any'}</td>
                      <td className="px-4 py-3">{p.current_uses}/{p.max_uses??'∞'}</td>
                      <td className="px-4 py-3"><Badge label={p.is_active?'Active':'Inactive'} color={p.is_active?'green':'gray'}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!promos.length&&<p className="text-center py-8 text-gray-400">No promo codes yet</p>}
            </div>
          </div>
        )}

        {/* AI GAME MASTER */}
        {tab==='ai-gm' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-800 mb-4">AI Game Master Script Generator</h3>
              <div className="space-y-4">
                <div><label className="text-xs text-gray-500">Room *</label><select className="w-full border rounded p-2 mt-1 text-sm" value={gmForm.room_id} onChange={e=>setGmForm(p=>({...p,room_id:e.target.value}))}><option value="">Select room...</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.room_name} ({r.theme})</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Group Type</label><select className="w-full border rounded p-2 mt-1 text-sm" value={gmForm.group_type} onChange={e=>setGmForm(p=>({...p,group_type:e.target.value}))}>{GROUP_TYPES.map(g=><option key={g}>{g}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Player Count</label><input type="number" className="w-full border rounded p-2 mt-1 text-sm" value={gmForm.player_count} onChange={e=>setGmForm(p=>({...p,player_count:e.target.value}))}/></div>
                <button onClick={genGmScript} disabled={gmLoading||!gmForm.room_id} className="w-full py-2 bg-purple-600 text-white rounded text-sm font-medium disabled:opacity-50">{gmLoading?'Generating Script...':'Generate GM Script'}</button>
              </div>
              {gmScript&&<pre className="mt-6 p-4 bg-gray-50 rounded text-sm whitespace-pre-wrap font-sans leading-relaxed">{gmScript}</pre>}
            </div>
          </div>
        )}
      </div>

      {showAddRoom&&<AddRoomModal onClose={()=>setShowAddRoom(false)} onSaved={()=>{setShowAddRoom(false);loadRooms();}}/>}
      {showAddBooking&&<AddBookingModal rooms={rooms} onClose={()=>setShowAddBooking(false)} onSaved={()=>{setShowAddBooking(false);loadBookings();}}/>}
      {showAddPromo&&<AddPromoModal onClose={()=>setShowAddPromo(false)} onSaved={()=>{setShowAddPromo(false);loadPromos();}}/>}
      {completeBooking&&<CompleteGameModal booking={completeBooking} onClose={()=>setCompleteBooking(null)} onSaved={()=>{setCompleteBooking(null);loadBookings();loadResults();}}/>}
    </div>
  );
}
