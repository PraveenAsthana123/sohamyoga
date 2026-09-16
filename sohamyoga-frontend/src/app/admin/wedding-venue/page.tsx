'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','bookings','booking-detail','venues','vendors','ai-planner','financials'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = {
  dashboard: 'Dashboard', bookings: 'Bookings', 'booking-detail': 'Booking Detail',
  venues: 'Venues', vendors: 'Preferred Vendors', 'ai-planner': 'AI Wedding Planner', financials: 'Financials',
};

const VENUE_TYPES = ['ballroom','garden','chapel','barn','rooftop','hall','outdoor','indoor_outdoor'];
const EVENT_TYPES = ['wedding','engagement_party','bridal_shower','reception_only','anniversary','birthday','corporate','other'];
const VENDOR_TYPES = ['catering','photography','videography','florist','dj','band','hair_makeup','officiant','transportation','cake','decor','other'];
const BOOKING_STATUSES = ['inquiry','site_visit','proposal_sent','contract_signed','planning','confirmed','completed','cancelled'];
const STATUS_PIPELINE = ['inquiry','site_visit','proposal_sent','contract_signed','planning','confirmed','completed'];

interface Venue { id:number; venue_name:string; venue_type:string; capacity_min:number; capacity_max:number; base_price:number; price_type:string; description:string; is_active:boolean; }
interface Booking { id:number; venue_id:number; venue_name:string; venue_type:string; couple_name1:string; couple_name2:string; contact_email:string; contact_phone:string; event_date:string; ceremony_time:string; reception_time:string; guest_count:number; event_type:string; status:string; total_package_price:number; deposit_amount:number; deposit_paid:boolean; balance_due:number; balance_paid:boolean; florist:string; photographer:string; wedding_coordinator:string; notes:string; }
interface PlanningTask { id:number; task_category:string; task_name:string; due_date:string; assigned_to:string; status:string; priority:string; notes:string; }
interface Vendor { id:number; vendor_type:string; vendor_name:string; contact_name:string; phone:string; email:string; website:string; commission_pct:number; is_active:boolean; }
interface DashData { bookings_this_year:number; inquiries_pending:number; revenue_confirmed:number; upcoming_events_30d:Booking[]; venues_count:number; }

function fmtDate(d:string){ return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtTime(t:string){ if(!t) return '—'; const [h,m]=t.split(':'); const hr=parseInt(h); return `${hr%12||12}:${m} ${hr>=12?'PM':'AM'}`; }
function fmtCad(n:number){ return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:0})}`; }

function Badge({ label, color='gray' }: { label:string; color?:string }) {
  const m:Record<string,string>={blue:'bg-blue-100 text-blue-700',green:'bg-green-100 text-green-700',amber:'bg-amber-100 text-amber-700',red:'bg-red-100 text-red-700',purple:'bg-purple-100 text-purple-700',gray:'bg-gray-100 text-gray-700',teal:'bg-teal-100 text-teal-700',rose:'bg-rose-100 text-rose-700',indigo:'bg-indigo-100 text-indigo-700',pink:'bg-pink-100 text-pink-700'};
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label}</span>;
}
function KpiCard({ label, value, sub, color='blue' }: { label:string; value:string|number; sub?:string; color?:string }) {
  const b:Record<string,string>={blue:'border-l-4 border-blue-500 bg-blue-50',green:'border-l-4 border-green-500 bg-green-50',amber:'border-l-4 border-amber-500 bg-amber-50',red:'border-l-4 border-red-500 bg-red-50',rose:'border-l-4 border-rose-500 bg-rose-50',purple:'border-l-4 border-purple-500 bg-purple-50'};
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function statusColor(s:string){ const m:Record<string,string>={inquiry:'gray',site_visit:'blue',proposal_sent:'purple',contract_signed:'teal',planning:'amber',confirmed:'green',completed:'indigo',cancelled:'red'}; return m[s]??'gray'; }
function priorityColor(p:string){ const m:Record<string,string>={low:'gray',medium:'blue',high:'amber',critical:'red'}; return m[p]??'gray'; }
function taskStatusColor(s:string){ const m:Record<string,string>={pending:'gray',in_progress:'blue',completed:'green',overdue:'red'}; return m[s]??'gray'; }

// ─── Add Venue Modal ──────────────────────────────────────────────────────────
function AddVenueModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState({ venue_name:'',venue_type:'ballroom',capacity_min:'',capacity_max:'',base_price:'',price_type:'per_day',description:'' });
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.venue_name||!form.base_price) return;
    setSaving(true);
    try{
      await fetch('/api/admin/wedding-venue/venues',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,capacity_min:form.capacity_min?parseInt(form.capacity_min):null,capacity_max:form.capacity_max?parseInt(form.capacity_max):null,base_price:parseFloat(form.base_price)})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-6 border-b"><h2 className="text-xl font-bold">Add Venue</h2></div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="text-xs text-gray-500">Venue Name *</label><input className="w-full border rounded p-2 mt-1" value={form.venue_name} onChange={e=>f('venue_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Venue Type</label><select className="w-full border rounded p-2 mt-1" value={form.venue_type} onChange={e=>f('venue_type',e.target.value)}>{VENUE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Price Type</label><select className="w-full border rounded p-2 mt-1" value={form.price_type} onChange={e=>f('price_type',e.target.value)}><option value="per_day">Per Day</option><option value="per_person">Per Person</option><option value="package">Package</option></select></div>
          <div><label className="text-xs text-gray-500">Min Capacity</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.capacity_min} onChange={e=>f('capacity_min',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Max Capacity</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.capacity_max} onChange={e=>f('capacity_max',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Base Price ($) *</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.base_price} onChange={e=>f('base_price',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded p-2 mt-1 h-20" value={form.description} onChange={e=>f('description',e.target.value)}/></div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-rose-600 text-white rounded disabled:opacity-50">{saving?'Saving...':'Add Venue'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Booking Modal ────────────────────────────────────────────────────────
function AddBookingModal({ venues, onClose, onSaved }: { venues:Venue[]; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState({ venue_id:'',couple_name1:'',couple_name2:'',contact_email:'',contact_phone:'',event_date:'',ceremony_time:'',reception_time:'',guest_count:'100',event_type:'wedding',total_package_price:'',deposit_amount:'',notes:'' });
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.couple_name1||!form.contact_email||!form.contact_phone||!form.event_date) return;
    setSaving(true);setError('');
    try{
      const r=await fetch('/api/admin/wedding-venue/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,venue_id:form.venue_id?parseInt(form.venue_id):null,guest_count:parseInt(form.guest_count),total_package_price:form.total_package_price?parseFloat(form.total_package_price):null,deposit_amount:form.deposit_amount?parseFloat(form.deposit_amount):null,balance_due:form.total_package_price&&form.deposit_amount?parseFloat(form.total_package_price)-parseFloat(form.deposit_amount):null})});
      if(!r.ok){const d=await r.json();setError(d.error);return;}
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b"><h2 className="text-xl font-bold">Add Inquiry / Booking</h2></div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500">Name 1 *</label><input className="w-full border rounded p-2 mt-1" placeholder="e.g. Sarah" value={form.couple_name1} onChange={e=>f('couple_name1',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Name 2</label><input className="w-full border rounded p-2 mt-1" placeholder="e.g. James" value={form.couple_name2} onChange={e=>f('couple_name2',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Email *</label><input className="w-full border rounded p-2 mt-1" value={form.contact_email} onChange={e=>f('contact_email',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded p-2 mt-1" value={form.contact_phone} onChange={e=>f('contact_phone',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Event Date *</label><input type="date" className="w-full border rounded p-2 mt-1" value={form.event_date} onChange={e=>f('event_date',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Event Type</label><select className="w-full border rounded p-2 mt-1" value={form.event_type} onChange={e=>f('event_type',e.target.value)}>{EVENT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Venue</label><select className="w-full border rounded p-2 mt-1" value={form.venue_id} onChange={e=>f('venue_id',e.target.value)}><option value="">TBD</option>{venues.map(v=><option key={v.id} value={v.id}>{v.venue_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Guest Count</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.guest_count} onChange={e=>f('guest_count',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Ceremony Time</label><input type="time" className="w-full border rounded p-2 mt-1" value={form.ceremony_time} onChange={e=>f('ceremony_time',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Reception Time</label><input type="time" className="w-full border rounded p-2 mt-1" value={form.reception_time} onChange={e=>f('reception_time',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Package Price ($)</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.total_package_price} onChange={e=>f('total_package_price',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Deposit ($)</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.deposit_amount} onChange={e=>f('deposit_amount',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded p-2 mt-1 h-16" value={form.notes} onChange={e=>f('notes',e.target.value)}/></div>
          {error&&<p className="col-span-2 text-red-500 text-sm">{error}</p>}
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-rose-600 text-white rounded disabled:opacity-50">{saving?'Saving...':'Add Inquiry'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Vendor Modal ─────────────────────────────────────────────────────────
function AddVendorModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState({ vendor_type:'catering',vendor_name:'',contact_name:'',phone:'',email:'',website:'',commission_pct:'0',notes:'' });
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.vendor_name) return;
    setSaving(true);
    try{
      await fetch('/api/admin/wedding-venue/vendors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,commission_pct:parseFloat(form.commission_pct)||0})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-6 border-b"><h2 className="text-xl font-bold">Add Preferred Vendor</h2></div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500">Vendor Type</label><select className="w-full border rounded p-2 mt-1" value={form.vendor_type} onChange={e=>f('vendor_type',e.target.value)}>{VENDOR_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Vendor Name *</label><input className="w-full border rounded p-2 mt-1" value={form.vendor_name} onChange={e=>f('vendor_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Contact Name</label><input className="w-full border rounded p-2 mt-1" value={form.contact_name} onChange={e=>f('contact_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Commission %</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.commission_pct} onChange={e=>f('commission_pct',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded p-2 mt-1" value={form.phone} onChange={e=>f('phone',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded p-2 mt-1" value={form.email} onChange={e=>f('email',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Website</label><input className="w-full border rounded p-2 mt-1" value={form.website} onChange={e=>f('website',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded p-2 mt-1 h-16" value={form.notes} onChange={e=>f('notes',e.target.value)}/></div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-rose-600 text-white rounded disabled:opacity-50">{saving?'Saving...':'Add Vendor'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────
function AddTaskModal({ bookingId, onClose, onSaved }: { bookingId:number; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState({ task_name:'',task_category:'',due_date:'',assigned_to:'',priority:'medium',notes:'' });
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.task_name) return;
    setSaving(true);
    try{
      await fetch(`/api/admin/wedding-venue/bookings/${bookingId}/tasks`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="p-6 border-b"><h2 className="text-xl font-bold">Add Planning Task</h2></div>
        <div className="p-6 space-y-3">
          <div><label className="text-xs text-gray-500">Task Name *</label><input className="w-full border rounded p-2 mt-1" value={form.task_name} onChange={e=>f('task_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Category</label><input className="w-full border rounded p-2 mt-1" placeholder="Catering, Venue, Decor..." value={form.task_category} onChange={e=>f('task_category',e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Due Date</label><input type="date" className="w-full border rounded p-2 mt-1" value={form.due_date} onChange={e=>f('due_date',e.target.value)}/></div>
            <div><label className="text-xs text-gray-500">Priority</label><select className="w-full border rounded p-2 mt-1" value={form.priority} onChange={e=>f('priority',e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
          </div>
          <div><label className="text-xs text-gray-500">Assigned To</label><input className="w-full border rounded p-2 mt-1" value={form.assigned_to} onChange={e=>f('assigned_to',e.target.value)}/></div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-rose-600 text-white rounded disabled:opacity-50">{saving?'Saving...':'Add Task'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WeddingVenuePage() {
  const [tab,setTab]=useState<Tab>('dashboard');
  const [dash,setDash]=useState<DashData|null>(null);
  const [venues,setVenues]=useState<Venue[]>([]);
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [vendors,setVendors]=useState<Vendor[]>([]);
  const [selectedBooking,setSelectedBooking]=useState<Booking|null>(null);
  const [bookingTasks,setBookingTasks]=useState<PlanningTask[]>([]);
  const [stats,setStats]=useState<{revenue_by_month?:{month:string;revenue:number}[];bookings_by_status?:{status:string;cnt:number;value:number}[];conversion?:{total_inquiries:number;converted:number;conversion_rate:number}}|null>(null);
  const [loading,setLoading]=useState(false);

  const [statusFilter,setStatusFilter]=useState('');
  const [venueFilter,setVenueFilter]=useState('');
  const [yearFilter,setYearFilter]=useState(String(new Date().getFullYear()));
  const [vendorTypeFilter,setVendorTypeFilter]=useState('');

  const [showAddVenue,setShowAddVenue]=useState(false);
  const [showAddBooking,setShowAddBooking]=useState(false);
  const [showAddVendor,setShowAddVendor]=useState(false);
  const [showAddTask,setShowAddTask]=useState(false);

  // AI
  const [aiMode,setAiMode]=useState<'proposal'|'timeline'>('proposal');
  const [aiForm,setAiForm]=useState({ couple_name1:'',couple_name2:'',event_date:'',guest_count:'150',venue_type:'ballroom',event_type:'wedding',ceremony_time:'14:00',reception_time:'17:00' });
  const [aiResult,setAiResult]=useState('');
  const [aiLoading,setAiLoading]=useState(false);

  const loadDash=useCallback(async()=>{ const r=await fetch('/api/admin/wedding-venue'); if(r.ok){const d=await r.json();setDash(d);} },[]);
  const loadVenues=useCallback(async()=>{ const r=await fetch('/api/admin/wedding-venue/venues'); if(r.ok){const d=await r.json();setVenues(d.venues);} },[]);
  const loadBookings=useCallback(async()=>{ setLoading(true); try{ const p=new URLSearchParams(); if(statusFilter)p.set('status',statusFilter); if(venueFilter)p.set('venue_id',venueFilter); if(yearFilter)p.set('year',yearFilter); const r=await fetch('/api/admin/wedding-venue/bookings?'+p); if(r.ok){const d=await r.json();setBookings(d.bookings);} }finally{setLoading(false);} },[statusFilter,venueFilter,yearFilter]);
  const loadVendors=useCallback(async()=>{ const p=new URLSearchParams(); if(vendorTypeFilter)p.set('type',vendorTypeFilter); const r=await fetch('/api/admin/wedding-venue/vendors?'+p); if(r.ok){const d=await r.json();setVendors(d.vendors);} },[vendorTypeFilter]);
  const loadStats=useCallback(async()=>{ const r=await fetch('/api/admin/wedding-venue/stats'); if(r.ok){const d=await r.json();setStats(d);} },[]);

  async function loadBookingDetail(b:Booking){ setSelectedBooking(b); const r=await fetch(`/api/admin/wedding-venue/bookings/${b.id}`); if(r.ok){const d=await r.json();setSelectedBooking(d.booking);setBookingTasks(d.tasks);} }
  async function advanceStatus(b:Booking){ const idx=STATUS_PIPELINE.indexOf(b.status); if(idx<STATUS_PIPELINE.length-1){ await fetch(`/api/admin/wedding-venue/bookings/${b.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:STATUS_PIPELINE[idx+1]})}); loadBookings(); if(selectedBooking?.id===b.id) loadBookingDetail({...b,status:STATUS_PIPELINE[idx+1]}); } }
  async function completeTask(taskId:number){ await fetch(`/api/admin/wedding-venue/bookings/${selectedBooking!.id}/tasks/${taskId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'completed'})}); if(selectedBooking) loadBookingDetail(selectedBooking); }

  useEffect(()=>{ loadDash(); loadVenues(); },[loadDash,loadVenues]);
  useEffect(()=>{ if(tab==='bookings') loadBookings(); if(tab==='vendors') loadVendors(); if(tab==='financials') loadStats(); },[tab,loadBookings,loadVendors,loadStats]);

  async function genAi(){ setAiLoading(true); try{ const ep=aiMode==='proposal'?'/api/admin/wedding-venue/ai-proposal':'/api/admin/wedding-venue/ai-timeline'; const r=await fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...aiForm,guest_count:parseInt(aiForm.guest_count)})}); if(r.ok){const d=await r.json();setAiResult(d.proposal||d.timeline||'');} }finally{setAiLoading(false);} }

  const taskCompletion = bookingTasks.length ? Math.round(bookingTasks.filter(t=>t.status==='completed').length/bookingTasks.length*100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Wedding Venue & Banquet Hall Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Bookings, planning tasks, preferred vendors, and AI wedding planner</p>
      </div>

      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab===t?'border-rose-500 text-rose-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>
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
              <KpiCard label="Bookings This Year" value={dash?.bookings_this_year??'—'} color="rose"/>
              <KpiCard label="Inquiries Pending" value={dash?.inquiries_pending??'—'} color="amber"/>
              <KpiCard label="Confirmed Revenue" value={fmtCad(dash?.revenue_confirmed??0)} color="green"/>
              <KpiCard label="Events in 30 Days" value={dash?.upcoming_events_30d?.length??'—'} color="purple"/>
              <KpiCard label="Active Venues" value={dash?.venues_count??'—'} color="blue"/>
            </div>

            {/* Pipeline Kanban */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Events Pipeline</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {STATUS_PIPELINE.map(s=>{
                  const cnt=dash?.upcoming_events_30d?.filter(b=>b.status===s).length||0;
                  return (
                    <div key={s} className="min-w-32 bg-gray-50 rounded-lg p-3 text-center border">
                      <Badge label={s.replace(/_/g,' ')} color={statusColor(s)}/>
                      <p className="text-2xl font-bold mt-2">{cnt}</p>
                      <p className="text-xs text-gray-400">events</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Upcoming Events (30 Days)</h3>
              {!dash?.upcoming_events_30d?.length&&<p className="text-gray-400 text-sm">No events in next 30 days</p>}
              <div className="space-y-2">
                {dash?.upcoming_events_30d?.map(b=>(
                  <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div><p className="font-medium text-sm">{b.couple_name1}{b.couple_name2&&` & ${b.couple_name2}`}</p><p className="text-xs text-gray-500">{fmtDate(b.event_date)} · {b.guest_count} guests · {b.event_type}</p></div>
                    <Badge label={b.status} color={statusColor(b.status)}/>
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
              <select className="border rounded p-2 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                {BOOKING_STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
              <select className="border rounded p-2 text-sm" value={venueFilter} onChange={e=>setVenueFilter(e.target.value)}>
                <option value="">All Venues</option>
                {venues.map(v=><option key={v.id} value={v.id}>{v.venue_name}</option>)}
              </select>
              <input className="border rounded p-2 text-sm w-24" placeholder="Year" value={yearFilter} onChange={e=>setYearFilter(e.target.value)}/>
              <button onClick={loadBookings} className="px-3 py-2 bg-gray-100 rounded text-sm">Filter</button>
              <div className="flex-1"/>
              <button onClick={()=>setShowAddBooking(true)} className="px-4 py-2 bg-rose-600 text-white rounded text-sm font-medium">+ Add Inquiry</button>
            </div>

            {loading ? <p className="text-gray-400">Loading...</p> : (
              <div className="space-y-2">
                {bookings.map(b=>(
                  <div key={b.id} className="bg-white rounded-xl border p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-28 text-center bg-rose-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">{fmtDate(b.event_date)}</p>
                        <p className="font-bold text-sm text-rose-700">{b.event_type}</p>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{b.couple_name1}{b.couple_name2&&` & ${b.couple_name2}`}</p>
                        <p className="text-sm text-gray-500">{b.venue_name||'Venue TBD'} · {b.guest_count} guests · {b.total_package_price?fmtCad(b.total_package_price):'TBD'}</p>
                        <p className="text-xs text-gray-400">{b.contact_email} · {b.contact_phone}</p>
                      </div>
                      <Badge label={b.status.replace(/_/g,' ')} color={statusColor(b.status)}/>
                      <div className="flex gap-2">
                        <button onClick={()=>{setSelectedBooking(b);loadBookingDetail(b);setTab('booking-detail');}} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs">Detail</button>
                        {b.status!=='completed'&&b.status!=='cancelled'&&<button onClick={()=>advanceStatus(b)} className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs">Advance</button>}
                      </div>
                    </div>
                  </div>
                ))}
                {!bookings.length&&<p className="text-center py-8 text-gray-400">No bookings found</p>}
              </div>
            )}
          </div>
        )}

        {/* BOOKING DETAIL */}
        {tab==='booking-detail' && (
          <div className="space-y-6">
            {!selectedBooking ? (
              <div className="bg-white rounded-xl border p-8 text-center">
                <p className="text-gray-400">Select a booking from the Bookings tab to view details</p>
                <button onClick={()=>setTab('bookings')} className="mt-4 px-4 py-2 bg-rose-600 text-white rounded text-sm">Go to Bookings</button>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold">{selectedBooking.couple_name1}{selectedBooking.couple_name2&&` & ${selectedBooking.couple_name2}`}</h2>
                      <p className="text-gray-500">{fmtDate(selectedBooking.event_date)} · {selectedBooking.venue_name||'TBD'} · {selectedBooking.guest_count} guests</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge label={selectedBooking.status.replace(/_/g,' ')} color={statusColor(selectedBooking.status)}/>
                      {selectedBooking.status!=='completed'&&selectedBooking.status!=='cancelled'&&(
                        <button onClick={()=>advanceStatus(selectedBooking)} className="px-3 py-1.5 bg-rose-600 text-white rounded text-sm">Advance Status</button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div className="bg-gray-50 rounded p-3"><p className="text-xs text-gray-500">Package</p><p className="font-bold">{selectedBooking.total_package_price?fmtCad(selectedBooking.total_package_price):'TBD'}</p></div>
                    <div className={`rounded p-3 ${selectedBooking.deposit_paid?'bg-green-50':'bg-amber-50'}`}><p className="text-xs text-gray-500">Deposit</p><p className="font-bold">{selectedBooking.deposit_amount?fmtCad(selectedBooking.deposit_amount):'TBD'} {selectedBooking.deposit_paid?'✓':''}</p></div>
                    <div className={`rounded p-3 ${selectedBooking.balance_paid?'bg-green-50':'bg-red-50'}`}><p className="text-xs text-gray-500">Balance</p><p className="font-bold">{selectedBooking.balance_due?fmtCad(selectedBooking.balance_due):'TBD'} {selectedBooking.balance_paid?'✓':''}</p></div>
                    <div className="bg-purple-50 rounded p-3"><p className="text-xs text-gray-500">Tasks</p><p className="font-bold">{taskCompletion}% done</p></div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                    <div><span className="text-gray-500">Ceremony:</span> {fmtTime(selectedBooking.ceremony_time)}</div>
                    <div><span className="text-gray-500">Reception:</span> {fmtTime(selectedBooking.reception_time)}</div>
                    <div><span className="text-gray-500">Coordinator:</span> {selectedBooking.wedding_coordinator||'—'}</div>
                    <div><span className="text-gray-500">Florist:</span> {selectedBooking.florist||'—'}</div>
                    <div><span className="text-gray-500">Photographer:</span> {selectedBooking.photographer||'—'}</div>
                    <div><span className="text-gray-500">Catering:</span> {selectedBooking.catering_included?selectedBooking.catering_provider||'Included':'External'}</div>
                  </div>
                </div>

                {/* Planning Tasks */}
                <div className="bg-white rounded-xl border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800">Planning Tasks ({bookingTasks.filter(t=>t.status==='completed').length}/{bookingTasks.length} completed)</h3>
                    <button onClick={()=>setShowAddTask(true)} className="px-3 py-1.5 bg-rose-600 text-white rounded text-sm">+ Add Task</button>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                    <div className="bg-rose-500 h-2 rounded-full transition-all" style={{width:`${taskCompletion}%`}}/>
                  </div>

                  <div className="space-y-2">
                    {bookingTasks.map(t=>(
                      <div key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border ${t.status==='completed'?'bg-green-50 border-green-100 opacity-70':'bg-white'}`}>
                        <button onClick={()=>t.status!=='completed'&&completeTask(t.id)} className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${t.status==='completed'?'bg-green-500 border-green-500':'border-gray-300'}`}>{t.status==='completed'&&<span className="text-white text-xs flex items-center justify-center h-full">✓</span>}</button>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${t.status==='completed'?'line-through text-gray-400':''}`}>{t.task_name}</p>
                          {t.task_category&&<p className="text-xs text-gray-400">{t.task_category}{t.assigned_to&&` · ${t.assigned_to}`}</p>}
                        </div>
                        <div className="flex gap-2 items-center">
                          {t.due_date&&<span className="text-xs text-gray-400">{fmtDate(t.due_date)}</span>}
                          <Badge label={t.priority} color={priorityColor(t.priority)}/>
                          <Badge label={t.status} color={taskStatusColor(t.status)}/>
                        </div>
                      </div>
                    ))}
                    {!bookingTasks.length&&<p className="text-gray-400 text-sm text-center py-4">No tasks yet</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* VENUES */}
        {tab==='venues' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={()=>setShowAddVenue(true)} className="px-4 py-2 bg-rose-600 text-white rounded text-sm font-medium">+ Add Venue</button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {venues.map(v=>(
                <div key={v.id} className={`bg-white rounded-xl border p-5 ${!v.is_active?'opacity-60':''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div><h3 className="font-semibold text-gray-800">{v.venue_name}</h3><p className="text-sm text-gray-500 capitalize">{v.venue_type?.replace(/_/g,' ')}</p></div>
                    <Badge label={v.is_active?'Active':'Inactive'} color={v.is_active?'green':'gray'}/>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{v.description}</p>
                  <div className="mt-3 text-sm space-y-1">
                    <p><span className="text-gray-500">Capacity:</span> {v.capacity_min}–{v.capacity_max} guests</p>
                    <p><span className="text-gray-500">Price:</span> {fmtCad(v.base_price)} / {v.price_type?.replace(/_/g,' ')}</p>
                  </div>
                </div>
              ))}
              {!venues.length&&<p className="col-span-3 text-center py-8 text-gray-400">No venues yet</p>}
            </div>
          </div>
        )}

        {/* VENDORS */}
        {tab==='vendors' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <select className="border rounded p-2 text-sm" value={vendorTypeFilter} onChange={e=>{setVendorTypeFilter(e.target.value);setTimeout(loadVendors,0);}}>
                <option value="">All Types</option>
                {VENDOR_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
              <div className="flex-1"/>
              <button onClick={()=>setShowAddVendor(true)} className="px-4 py-2 bg-rose-600 text-white rounded text-sm font-medium">+ Add Vendor</button>
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Type','Vendor','Contact','Phone','Email','Commission','Status'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {vendors.map(v=>(
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><Badge label={v.vendor_type} color="pink"/></td>
                      <td className="px-4 py-3 font-medium">{v.vendor_name}</td>
                      <td className="px-4 py-3">{v.contact_name||'—'}</td>
                      <td className="px-4 py-3">{v.phone||'—'}</td>
                      <td className="px-4 py-3">{v.email||'—'}</td>
                      <td className="px-4 py-3">{v.commission_pct>0?`${v.commission_pct}%`:'—'}</td>
                      <td className="px-4 py-3"><Badge label={v.is_active?'Active':'Inactive'} color={v.is_active?'green':'gray'}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!vendors.length&&<p className="text-center py-8 text-gray-400">No vendors found</p>}
            </div>
          </div>
        )}

        {/* AI WEDDING PLANNER */}
        {tab==='ai-planner' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-800 mb-4">AI Wedding Planner</h3>
              <div className="flex gap-3 mb-4">
                <button onClick={()=>{setAiMode('proposal');setAiResult('');}} className={`px-4 py-2 rounded text-sm font-medium ${aiMode==='proposal'?'bg-rose-600 text-white':'border'}`}>Generate Proposal</button>
                <button onClick={()=>{setAiMode('timeline');setAiResult('');}} className={`px-4 py-2 rounded text-sm font-medium ${aiMode==='timeline'?'bg-rose-600 text-white':'border'}`}>Generate Timeline</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {aiMode==='proposal'&&<>
                  <div><label className="text-xs text-gray-500">Name 1</label><input className="w-full border rounded p-2 mt-1 text-sm" value={aiForm.couple_name1} onChange={e=>setAiForm(p=>({...p,couple_name1:e.target.value}))}/></div>
                  <div><label className="text-xs text-gray-500">Name 2</label><input className="w-full border rounded p-2 mt-1 text-sm" value={aiForm.couple_name2} onChange={e=>setAiForm(p=>({...p,couple_name2:e.target.value}))}/></div>
                  <div><label className="text-xs text-gray-500">Event Date</label><input type="date" className="w-full border rounded p-2 mt-1 text-sm" value={aiForm.event_date} onChange={e=>setAiForm(p=>({...p,event_date:e.target.value}))}/></div>
                  <div><label className="text-xs text-gray-500">Event Type</label><select className="w-full border rounded p-2 mt-1 text-sm" value={aiForm.event_type} onChange={e=>setAiForm(p=>({...p,event_type:e.target.value}))}>{EVENT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                </>}
                <div><label className="text-xs text-gray-500">Guest Count</label><input type="number" className="w-full border rounded p-2 mt-1 text-sm" value={aiForm.guest_count} onChange={e=>setAiForm(p=>({...p,guest_count:e.target.value}))}/></div>
                <div><label className="text-xs text-gray-500">Venue Type</label><select className="w-full border rounded p-2 mt-1 text-sm" value={aiForm.venue_type} onChange={e=>setAiForm(p=>({...p,venue_type:e.target.value}))}>{VENUE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                {aiMode==='timeline'&&<>
                  <div><label className="text-xs text-gray-500">Ceremony Time</label><input type="time" className="w-full border rounded p-2 mt-1 text-sm" value={aiForm.ceremony_time} onChange={e=>setAiForm(p=>({...p,ceremony_time:e.target.value}))}/></div>
                  <div><label className="text-xs text-gray-500">Reception Time</label><input type="time" className="w-full border rounded p-2 mt-1 text-sm" value={aiForm.reception_time} onChange={e=>setAiForm(p=>({...p,reception_time:e.target.value}))}/></div>
                </>}
              </div>

              <button onClick={genAi} disabled={aiLoading} className="w-full mt-4 py-2 bg-rose-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiLoading?'Generating...':`Generate ${aiMode==='proposal'?'Proposal':'Timeline'}`}</button>
              {aiResult&&<pre className="mt-4 p-4 bg-gray-50 rounded text-sm whitespace-pre-wrap font-sans leading-relaxed">{aiResult}</pre>}
            </div>
          </div>
        )}

        {/* FINANCIALS */}
        {tab==='financials' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {stats?.bookings_by_status?.map(s=>(
                <div key={s.status} className="bg-white rounded-xl border p-4">
                  <Badge label={s.status.replace(/_/g,' ')} color={statusColor(s.status)}/>
                  <p className="text-2xl font-bold mt-2">{Number(s.cnt)}</p>
                  <p className="text-sm text-gray-500">{fmtCad(Number(s.value))}</p>
                </div>
              ))}
            </div>

            {stats?.conversion&&(
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Lead Conversion</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center"><p className="text-3xl font-bold text-gray-700">{stats.conversion.total_inquiries}</p><p className="text-sm text-gray-500">Total Inquiries</p></div>
                  <div className="text-center"><p className="text-3xl font-bold text-green-700">{stats.conversion.converted}</p><p className="text-sm text-gray-500">Converted</p></div>
                  <div className="text-center"><p className="text-3xl font-bold text-rose-700">{stats.conversion.conversion_rate}%</p><p className="text-sm text-gray-500">Conversion Rate</p></div>
                </div>
              </div>
            )}

            {stats?.revenue_by_month&&(
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Revenue by Month</h3>
                <div className="space-y-2">
                  {stats.revenue_by_month.map(m=>(
                    <div key={m.month} className="flex items-center gap-4">
                      <p className="w-20 text-sm text-gray-500">{m.month}</p>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div className="bg-rose-400 h-4 rounded-full" style={{width:`${Math.min(100,Number(m.revenue)/Math.max(...stats.revenue_by_month!.map(x=>Number(x.revenue)))*100)}%`}}/>
                      </div>
                      <p className="w-28 text-sm font-medium text-right">{fmtCad(Number(m.revenue))}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddVenue&&<AddVenueModal onClose={()=>setShowAddVenue(false)} onSaved={()=>{setShowAddVenue(false);loadVenues();}}/>}
      {showAddBooking&&<AddBookingModal venues={venues} onClose={()=>setShowAddBooking(false)} onSaved={()=>{setShowAddBooking(false);loadBookings();}}/>}
      {showAddVendor&&<AddVendorModal onClose={()=>setShowAddVendor(false)} onSaved={()=>{setShowAddVendor(false);loadVendors();}}/>}
      {showAddTask&&selectedBooking&&<AddTaskModal bookingId={selectedBooking.id} onClose={()=>setShowAddTask(false)} onSaved={()=>{setShowAddTask(false);loadBookingDetail(selectedBooking);}}/>}
    </div>
  );
}
