'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','work-orders','inspection','line-items','customers','technicians','ai-diagnostics'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = {
  'dashboard': 'Dashboard',
  'work-orders': 'Work Orders',
  'inspection': 'Vehicle Inspection',
  'line-items': 'Parts & Labour',
  'customers': 'Customers',
  'technicians': 'Technicians',
  'ai-diagnostics': 'AI Diagnostics',
};

const WO_STATUSES = ['check_in','diagnosis','estimate_sent','approved','in_progress','quality_check','ready','completed','invoiced','cancelled'];
const ITEM_TYPES = ['labour','part','fluid','sublet','shop_supply'];
const FUEL_TYPES = ['gasoline','diesel','hybrid','electric','propane'];
const TRANSMISSIONS = ['automatic','manual','cvt'];
const PAYMENT_METHODS = ['cash','debit','credit','etransfer','insurance'];

interface DashData { work_orders_in_shop: number; vehicles_ready_for_pickup: number; revenue_today: number; avg_rating_mtd: number|null; status_breakdown: Record<string,number>; technician_load: {technician:string;wo_count:number}[]; }
interface WorkOrder { id:number; wo_number:string; customer_id:number; vehicle_id:number; first_name:string; last_name:string; phone:string; year:number; make:string; model:string; license_plate:string; color:string; technician:string; service_advisor:string; status:string; customer_concern:string; subtotal:number; tax_amount:number; total_amount:number; payment_status:string; customer_rating:number|null; created_at:string; odometer_in:number; inspection_complete:boolean; }
interface Customer { id:number; first_name:string; last_name:string; email:string; phone:string; city:string; province:string; total_visits:number; total_spent:number; vehicle_count:number; }
interface Vehicle { id:number; customer_id:number; year:number; make:string; model:string; license_plate:string; color:string; odometer_km:number; fuel_type:string; first_name:string; last_name:string; }
interface LineItem { id:number; work_order_id:number; item_type:string; description:string; quantity:number; unit_price:number; labour_hours:number|null; technician:string|null; status:string; part_number?:string; }

function fmtCad(n:number) { return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
function fmtDate(d:string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

function Badge({ label, color='gray' }:{label:string;color?:string}) {
  const m:Record<string,string> = { blue:'bg-blue-100 text-blue-700', green:'bg-green-100 text-green-700', amber:'bg-amber-100 text-amber-700', red:'bg-red-100 text-red-700', purple:'bg-purple-100 text-purple-700', gray:'bg-gray-100 text-gray-700', teal:'bg-teal-100 text-teal-700', orange:'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}

function KpiCard({ label, value, sub, color='blue' }:{label:string;value:string|number;sub?:string;color?:string}) {
  const b:Record<string,string> = { blue:'border-l-4 border-blue-500 bg-blue-50', green:'border-l-4 border-green-500 bg-green-50', amber:'border-l-4 border-amber-500 bg-amber-50', red:'border-l-4 border-red-500 bg-red-50', purple:'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}

function statusColor(s:string):string {
  const m:Record<string,string> = { check_in:'blue', diagnosis:'purple', estimate_sent:'orange', approved:'teal', in_progress:'amber', quality_check:'amber', ready:'green', completed:'green', invoiced:'gray', cancelled:'red' };
  return m[s]??'gray';
}

// ─── Add Customer Modal ────────────────────────────────────────────────────────
function AddCustomerModal({ onClose, onSaved }:{onClose:()=>void;onSaved:()=>void}) {
  const [f, setF] = useState({ first_name:'', last_name:'', email:'', phone:'', address:'', city:'Calgary', province:'AB', preferred_contact:'phone', notes:'' });
  const [saving, setSaving] = useState(false);
  const up = (k:string,v:string) => setF(p=>({...p,[k]:v}));
  async function submit() {
    if (!f.first_name || !f.last_name || !f.phone) return;
    setSaving(true);
    try { await fetch('/api/admin/auto-repair/customers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(f) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4">New Customer</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.first_name} onChange={e=>up('first_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.last_name} onChange={e=>up('last_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.phone} onChange={e=>up('phone',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.email} onChange={e=>up('email',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Address</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.address} onChange={e=>up('address',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.city} onChange={e=>up('city',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Preferred Contact</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.preferred_contact} onChange={e=>up('preferred_contact',e.target.value)}><option value="phone">Phone</option><option value="email">Email</option><option value="text">Text</option></select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={f.notes} onChange={e=>up('notes',e.target.value)}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving?'Saving…':'Add Customer'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Work Order Modal ─────────────────────────────────────────────────────
function AddWOModal({ customers, vehicles, onClose, onSaved }:{customers:Customer[];vehicles:Vehicle[];onClose:()=>void;onSaved:()=>void}) {
  const [f, setF] = useState({ customer_id:'', vehicle_id:'', technician:'', service_advisor:'', odometer_in:'', customer_concern:'', promised_time:'' });
  const [saving, setSaving] = useState(false);
  const up = (k:string,v:string) => setF(p=>({...p,[k]:v}));
  const filteredVehicles = vehicles.filter(v => !f.customer_id || v.customer_id === parseInt(f.customer_id));
  async function submit() {
    if (!f.customer_id || !f.vehicle_id || !f.customer_concern) return;
    setSaving(true);
    try { await fetch('/api/admin/auto-repair/work-orders', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...f, customer_id:parseInt(f.customer_id), vehicle_id:parseInt(f.vehicle_id), odometer_in:f.odometer_in?parseInt(f.odometer_in):null}) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4">New Work Order</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Customer *</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.customer_id} onChange={e=>{up('customer_id',e.target.value);up('vehicle_id','');}}>
              <option value="">— select customer —</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.last_name}, {c.first_name} · {c.phone}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Vehicle *</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.vehicle_id} onChange={e=>up('vehicle_id',e.target.value)}>
              <option value="">— select vehicle —</option>
              {filteredVehicles.map(v=><option key={v.id} value={v.id}>{v.year} {v.make} {v.model} · {v.license_plate}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Technician</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.technician} onChange={e=>up('technician',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Service Advisor</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.service_advisor} onChange={e=>up('service_advisor',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Odometer In (km)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.odometer_in} onChange={e=>up('odometer_in',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Promised Time</label><input type="datetime-local" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.promised_time} onChange={e=>up('promised_time',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Customer Concern *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={f.customer_concern} onChange={e=>up('customer_concern',e.target.value)} placeholder="Describe the customer's complaint…"/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving?'Creating…':'Create Work Order'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete WO Modal ────────────────────────────────────────────────────────
function CompleteWOModal({ wo, onClose, onSaved }:{wo:WorkOrder;onClose:()=>void;onSaved:()=>void}) {
  const [f, setF] = useState({ odometer_out:'', total_amount:String(wo.total_amount), payment_method:'cash', customer_rating:'' });
  const [saving, setSaving] = useState(false);
  const up = (k:string,v:string) => setF(p=>({...p,[k]:v}));
  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/admin/auto-repair/work-orders/${wo.id}/complete`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ odometer_out:f.odometer_out?parseInt(f.odometer_out):null, total_amount:parseFloat(f.total_amount), payment_method:f.payment_method, customer_rating:f.customer_rating?parseInt(f.customer_rating):null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-1">Complete Work Order</h2>
        <p className="text-sm text-gray-500 mb-4">{wo.wo_number} — {wo.year} {wo.make} {wo.model}</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Odometer Out (km)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.odometer_out} onChange={e=>up('odometer_out',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Total Amount (CAD)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.total_amount} onChange={e=>up('total_amount',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Payment Method *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.payment_method} onChange={e=>up('payment_method',e.target.value)}>{PAYMENT_METHODS.map(m=><option key={m}>{m}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Customer Rating (1-5)</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.customer_rating} onChange={e=>up('customer_rating',e.target.value)}><option value="">—</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{'⭐'.repeat(n)} ({n})</option>)}</select></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50">{saving?'Completing…':'Mark Complete & Paid'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Line Item Modal ──────────────────────────────────────────────────────
function AddLineItemModal({ woId, onClose, onSaved }:{woId:number;onClose:()=>void;onSaved:()=>void}) {
  const [f, setF] = useState({ item_type:'labour', description:'', part_number:'', quantity:'1', unit_cost:'', unit_price:'', labour_hours:'', technician:'' });
  const [saving, setSaving] = useState(false);
  const up = (k:string,v:string) => setF(p=>({...p,[k]:v}));
  async function submit() {
    if (!f.description || !f.unit_price) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/auto-repair/work-orders/${woId}/line-items`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ item_type:f.item_type, description:f.description, part_number:f.part_number||null, quantity:parseFloat(f.quantity)||1, unit_cost:f.unit_cost?parseFloat(f.unit_cost):null, unit_price:parseFloat(f.unit_price), labour_hours:f.labour_hours?parseFloat(f.labour_hours):null, technician:f.technician||null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">Add Line Item</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.item_type} onChange={e=>up('item_type',e.target.value)}>{ITEM_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Qty</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.quantity} onChange={e=>up('quantity',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.description} onChange={e=>up('description',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Part #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={f.part_number} onChange={e=>up('part_number',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Unit Price (CAD) *</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.unit_price} onChange={e=>up('unit_price',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Unit Cost (CAD)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.unit_cost} onChange={e=>up('unit_cost',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Labour Hours</label><input type="number" step="0.25" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.labour_hours} onChange={e=>up('labour_hours',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Technician</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.technician} onChange={e=>up('technician',e.target.value)}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving?'Adding…':'Add Item'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab({ dash, workOrders }:{dash:DashData|null;workOrders:WorkOrder[]}) {
  if (!dash) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  const shopOrders = workOrders.filter(wo => !['completed','invoiced','cancelled'].includes(wo.status));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Vehicles In Shop" value={dash.work_orders_in_shop} color="blue"/>
        <KpiCard label="Ready for Pickup" value={dash.vehicles_ready_for_pickup} color="green"/>
        <KpiCard label="Revenue Today" value={fmtCad(dash.revenue_today)} color="amber"/>
        <KpiCard label="Avg Rating MTD" value={dash.avg_rating_mtd ? `${dash.avg_rating_mtd}★` : '—'} color="purple"/>
      </div>
      {/* Shop Floor Board */}
      <div>
        <h3 className="font-semibold text-slate-700 mb-3">Shop Floor Board</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {shopOrders.length === 0 && <p className="text-gray-400 text-sm col-span-3">No active work orders.</p>}
          {shopOrders.map(wo=>(
            <div key={wo.id} className={`rounded-lg border-2 p-3 ${wo.status==='ready'?'border-green-400 bg-green-50':wo.status==='in_progress'?'border-amber-400 bg-amber-50':'border-gray-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-slate-600">{wo.wo_number}</span>
                <Badge label={wo.status} color={statusColor(wo.status)}/>
              </div>
              <p className="font-medium text-sm">{wo.year} {wo.make} {wo.model} <span className="text-gray-400 font-normal">{wo.license_plate}</span></p>
              <p className="text-xs text-gray-500">{wo.last_name}, {wo.first_name}</p>
              <p className="text-xs text-gray-400 mt-1 truncate">{wo.customer_concern}</p>
              {wo.technician && <p className="text-xs text-blue-600 mt-1">Tech: {wo.technician}</p>}
            </div>
          ))}
        </div>
      </div>
      {/* Technician Load */}
      <div>
        <h3 className="font-semibold text-slate-700 mb-3">Technician Workload</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {dash.technician_load.map(t=>(
            <div key={t.technician} className="bg-white border rounded-lg p-3">
              <p className="font-medium text-sm">{t.technician}</p>
              <p className="text-2xl font-bold text-blue-600">{t.wo_count}</p>
              <p className="text-xs text-gray-400">active WOs</p>
            </div>
          ))}
          {dash.technician_load.length===0 && <p className="text-gray-400 text-sm">No technicians assigned.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Work Orders Tab ──────────────────────────────────────────────────────────
function WorkOrdersTab({ workOrders, customers, vehicles, reload }:{workOrders:WorkOrder[];customers:Customer[];vehicles:Vehicle[];reload:()=>void}) {
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddWO, setShowAddWO] = useState(false);
  const [completeWO, setCompleteWO] = useState<WorkOrder|null>(null);

  const filtered = workOrders.filter(wo => !statusFilter || wo.status === statusFilter);

  async function advanceStatus(wo:WorkOrder) {
    const flow = ['check_in','diagnosis','estimate_sent','approved','in_progress','quality_check','ready'];
    const idx = flow.indexOf(wo.status);
    if (idx < 0 || idx >= flow.length-1) return;
    const next = flow[idx+1];
    await fetch(`/api/admin/auto-repair/work-orders/${wo.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status:next }) });
    reload();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {WO_STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
        <span className="text-sm text-gray-400">{filtered.length} work orders</span>
        <button onClick={()=>setShowAddWO(true)} className="ml-auto px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg">+ New Work Order</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b"><th className="text-left px-3 py-2 font-medium text-gray-600">WO #</th><th className="text-left px-3 py-2 font-medium text-gray-600">Customer</th><th className="text-left px-3 py-2 font-medium text-gray-600">Vehicle</th><th className="text-left px-3 py-2 font-medium text-gray-600">Tech</th><th className="text-left px-3 py-2 font-medium text-gray-600">Status</th><th className="text-right px-3 py-2 font-medium text-gray-600">Total</th><th className="text-left px-3 py-2 font-medium text-gray-600">Actions</th></tr></thead>
          <tbody>
            {filtered.map(wo=>(
              <tr key={wo.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs font-bold">{wo.wo_number}</td>
                <td className="px-3 py-2"><p className="font-medium">{wo.last_name}, {wo.first_name}</p><p className="text-xs text-gray-400">{wo.phone}</p></td>
                <td className="px-3 py-2"><p>{wo.year} {wo.make} {wo.model}</p><p className="text-xs text-gray-400">{wo.license_plate} · {wo.color}</p></td>
                <td className="px-3 py-2 text-xs">{wo.technician||'—'}</td>
                <td className="px-3 py-2"><Badge label={wo.status} color={statusColor(wo.status)}/></td>
                <td className="px-3 py-2 text-right font-mono">{fmtCad(wo.total_amount)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {!['completed','invoiced','cancelled'].includes(wo.status) && wo.status !== 'ready' && (
                      <button onClick={()=>advanceStatus(wo)} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Advance</button>
                    )}
                    {wo.status === 'ready' && (
                      <button onClick={()=>setCompleteWO(wo)} className="text-xs px-2 py-1 bg-green-600 text-white rounded">Complete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No work orders found.</td></tr>}
          </tbody>
        </table>
      </div>
      {showAddWO && <AddWOModal customers={customers} vehicles={vehicles} onClose={()=>setShowAddWO(false)} onSaved={()=>{setShowAddWO(false);reload();}}/>}
      {completeWO && <CompleteWOModal wo={completeWO} onClose={()=>setCompleteWO(null)} onSaved={()=>{setCompleteWO(null);reload();}}/>}
    </div>
  );
}

// ─── Inspection Tab ───────────────────────────────────────────────────────────
function InspectionTab({ workOrders, reload }:{workOrders:WorkOrder[];reload:()=>void}) {
  const [woId, setWoId] = useState('');
  const [f, setF] = useState({ tire_tread_mm:'', battery_cca:'', brake_pct_front:'', brake_pct_rear:'', inspection_notes:'' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const up = (k:string,v:string) => setF(p=>({...p,[k]:v}));
  const activeWOs = workOrders.filter(wo=>!['completed','invoiced','cancelled'].includes(wo.status));

  function condColor(val:number, type:'tire'|'brake'|'battery'):string {
    if (type==='tire') return val >= 4 ? 'text-green-600' : val >= 2 ? 'text-amber-600' : 'text-red-600';
    if (type==='brake') return val >= 50 ? 'text-green-600' : val >= 25 ? 'text-amber-600' : 'text-red-600';
    return val >= 500 ? 'text-green-600' : val >= 350 ? 'text-amber-600' : 'text-red-600';
  }

  async function submit() {
    if (!woId) return;
    setSaving(true);
    try {
      await fetch('/api/admin/auto-repair/inspection', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ work_order_id:parseInt(woId), tire_tread_mm:f.tire_tread_mm?parseFloat(f.tire_tread_mm):null, battery_cca:f.battery_cca?parseInt(f.battery_cca):null, brake_pct_front:f.brake_pct_front?parseInt(f.brake_pct_front):null, brake_pct_rear:f.brake_pct_rear?parseInt(f.brake_pct_rear):null, inspection_notes:f.inspection_notes||null }) });
      setSaved(true); reload();
    } finally { setSaving(false); }
  }

  const wo = activeWOs.find(w=>String(w.id)===woId);
  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700">Select Work Order</label>
        <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={woId} onChange={e=>{setWoId(e.target.value);setSaved(false);}}>
          <option value="">— select —</option>
          {activeWOs.map(w=><option key={w.id} value={w.id}>{w.wo_number} — {w.year} {w.make} {w.model} ({w.last_name})</option>)}
        </select>
      </div>
      {wo && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <strong>{wo.wo_number}</strong> · {wo.year} {wo.make} {wo.model} · {wo.license_plate}<br/>
            <span className="text-gray-500">Odometer in: {wo.odometer_in ? `${wo.odometer_in.toLocaleString()} km` : '—'}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2">Tire Tread (mm)</h4>
              <input type="number" step="0.5" min="0" max="12" className="w-full border rounded px-2 py-1.5 text-sm" placeholder="e.g. 4.5" value={f.tire_tread_mm} onChange={e=>up('tire_tread_mm',e.target.value)}/>
              {f.tire_tread_mm && <p className={`text-xs mt-1 font-medium ${condColor(parseFloat(f.tire_tread_mm),'tire')}`}>{parseFloat(f.tire_tread_mm)>=4?'Good':'Attention required'}</p>}
            </div>
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2">Battery CCA</h4>
              <input type="number" className="w-full border rounded px-2 py-1.5 text-sm" placeholder="e.g. 520" value={f.battery_cca} onChange={e=>up('battery_cca',e.target.value)}/>
              {f.battery_cca && <p className={`text-xs mt-1 font-medium ${condColor(parseInt(f.battery_cca),'battery')}`}>{parseInt(f.battery_cca)>=500?'Good':'Attention required'}</p>}
            </div>
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2">Front Brakes (%)</h4>
              <input type="number" min="0" max="100" className="w-full border rounded px-2 py-1.5 text-sm" placeholder="e.g. 60" value={f.brake_pct_front} onChange={e=>up('brake_pct_front',e.target.value)}/>
              {f.brake_pct_front && <p className={`text-xs mt-1 font-medium ${condColor(parseInt(f.brake_pct_front),'brake')}`}>{parseInt(f.brake_pct_front)>=50?'Good':'Attention required'}</p>}
            </div>
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2">Rear Brakes (%)</h4>
              <input type="number" min="0" max="100" className="w-full border rounded px-2 py-1.5 text-sm" placeholder="e.g. 45" value={f.brake_pct_rear} onChange={e=>up('brake_pct_rear',e.target.value)}/>
              {f.brake_pct_rear && <p className={`text-xs mt-1 font-medium ${condColor(parseInt(f.brake_pct_rear),'brake')}`}>{parseInt(f.brake_pct_rear)>=50?'Good':'Attention required'}</p>}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Inspection Notes</label>
            <textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={4} value={f.inspection_notes} onChange={e=>up('inspection_notes',e.target.value)} placeholder="Document findings, fluid levels, leaks, unusual wear patterns…"/>
          </div>
          {saved && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">Inspection saved successfully.</div>}
          <button onClick={submit} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">{saving?'Saving…':'Save Inspection'}</button>
        </div>
      )}
    </div>
  );
}

// ─── Line Items Tab ───────────────────────────────────────────────────────────
function LineItemsTab({ workOrders }:{workOrders:WorkOrder[]}) {
  const [woId, setWoId] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [woDetail, setWoDetail] = useState<WorkOrder|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeWOs = workOrders.filter(wo=>!['cancelled'].includes(wo.status));

  const loadItems = useCallback(async (id:string) => {
    setLoading(true);
    const [liRes, woRes] = await Promise.all([
      fetch(`/api/admin/auto-repair/work-orders/${id}/line-items`).then(r=>r.json()),
      fetch(`/api/admin/auto-repair/work-orders/${id}`).then(r=>r.json()),
    ]);
    setItems(liRes);
    setWoDetail(woRes.work_order);
    setLoading(false);
  }, []);

  useEffect(() => { if (woId) loadItems(woId); }, [woId, loadItems]);

  async function deleteItem(liId:number) {
    if (!confirm('Delete this line item?')) return;
    await fetch(`/api/admin/auto-repair/work-orders/${woId}/line-items/${liId}`, { method:'DELETE' });
    loadItems(woId);
  }

  return (
    <div>
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700">Select Work Order</label>
        <select className="mt-1 w-full max-w-md border rounded-lg px-3 py-2 text-sm" value={woId} onChange={e=>setWoId(e.target.value)}>
          <option value="">— select —</option>
          {activeWOs.map(w=><option key={w.id} value={w.id}>{w.wo_number} — {w.year} {w.make} {w.model} ({w.last_name})</option>)}
        </select>
      </div>
      {woDetail && (
        <div className="flex items-center gap-4 mb-4 bg-gray-50 rounded-lg p-3">
          <div><span className="text-xs text-gray-500">Subtotal</span><p className="font-mono font-bold">{fmtCad(woDetail.subtotal)}</p></div>
          <div><span className="text-xs text-gray-500">GST (5%)</span><p className="font-mono font-bold">{fmtCad(woDetail.tax_amount)}</p></div>
          <div><span className="text-xs text-gray-500">Total</span><p className="font-mono font-bold text-green-700">{fmtCad(woDetail.total_amount)}</p></div>
          <button onClick={()=>setShowAdd(true)} className="ml-auto px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg">+ Add Item</button>
        </div>
      )}
      {loading && <div className="text-center py-8 text-gray-400">Loading…</div>}
      {!loading && woId && (
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b"><th className="text-left px-3 py-2 font-medium text-gray-600">Type</th><th className="text-left px-3 py-2 font-medium text-gray-600">Description</th><th className="text-left px-3 py-2 font-medium text-gray-600">Part #</th><th className="text-right px-3 py-2 font-medium text-gray-600">Qty</th><th className="text-right px-3 py-2 font-medium text-gray-600">Price</th><th className="text-right px-3 py-2 font-medium text-gray-600">Line Total</th><th className="text-left px-3 py-2 font-medium text-gray-600">Status</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {items.map(li=>(
              <tr key={li.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2"><Badge label={li.item_type} color={li.item_type==='labour'?'blue':li.item_type==='part'?'amber':'gray'}/></td>
                <td className="px-3 py-2">{li.description}{li.labour_hours&&<span className="text-xs text-gray-400 ml-1">({li.labour_hours}h)</span>}</td>
                <td className="px-3 py-2 font-mono text-xs">{li.part_number||'—'}</td>
                <td className="px-3 py-2 text-right">{li.quantity}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtCad(li.unit_price)}</td>
                <td className="px-3 py-2 text-right font-mono font-medium">{fmtCad(li.quantity*li.unit_price)}</td>
                <td className="px-3 py-2"><Badge label={li.status} color={li.status==='installed'?'green':li.status==='warranty'?'purple':'gray'}/></td>
                <td className="px-3 py-2"><button onClick={()=>deleteItem(li.id)} className="text-xs text-red-500 hover:underline">Del</button></td>
              </tr>
            ))}
            {items.length===0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No line items. Add parts or labour above.</td></tr>}
          </tbody>
        </table>
      )}
      {showAdd && woId && <AddLineItemModal woId={parseInt(woId)} onClose={()=>setShowAdd(false)} onSaved={()=>{setShowAdd(false);loadItems(woId);}}/>}
    </div>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────
function CustomersTab({ customers, reload }:{customers:Customer[];reload:()=>void}) {
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const filtered = customers.filter(c => !q || `${c.first_name} ${c.last_name} ${c.phone} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input className="border rounded-lg px-3 py-1.5 text-sm w-64" placeholder="Search name, phone, email…" value={q} onChange={e=>setQ(e.target.value)}/>
        <button onClick={()=>setShowAdd(true)} className="ml-auto px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg">+ Add Customer</button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50 border-b"><th className="text-left px-3 py-2 font-medium text-gray-600">Name</th><th className="text-left px-3 py-2 font-medium text-gray-600">Phone</th><th className="text-left px-3 py-2 font-medium text-gray-600">City</th><th className="text-right px-3 py-2 font-medium text-gray-600">Vehicles</th><th className="text-right px-3 py-2 font-medium text-gray-600">Visits</th><th className="text-right px-3 py-2 font-medium text-gray-600">Total Spent</th></tr></thead>
        <tbody>
          {filtered.map(c=>(
            <tr key={c.id} className="border-b hover:bg-gray-50">
              <td className="px-3 py-2"><p className="font-medium">{c.last_name}, {c.first_name}</p><p className="text-xs text-gray-400">{c.email}</p></td>
              <td className="px-3 py-2">{c.phone}</td>
              <td className="px-3 py-2">{c.city}, {c.province}</td>
              <td className="px-3 py-2 text-right">{c.vehicle_count}</td>
              <td className="px-3 py-2 text-right">{c.total_visits}</td>
              <td className="px-3 py-2 text-right font-mono">{fmtCad(c.total_spent)}</td>
            </tr>
          ))}
          {filtered.length===0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No customers found.</td></tr>}
        </tbody>
      </table>
      {showAdd && <AddCustomerModal onClose={()=>setShowAdd(false)} onSaved={()=>{setShowAdd(false);reload();}}/>}
    </div>
  );
}

// ─── Technicians Tab ──────────────────────────────────────────────────────────
function TechniciansTab({ workOrders }:{workOrders:WorkOrder[]}) {
  const techMap: Record<string, WorkOrder[]> = {};
  workOrders.filter(wo=>wo.technician).forEach(wo=>{
    if (!techMap[wo.technician]) techMap[wo.technician]=[];
    techMap[wo.technician].push(wo);
  });
  return (
    <div>
      <h3 className="font-semibold text-slate-700 mb-4">Technician Productivity (All Time)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(techMap).map(([tech, wos])=>{
          const active = wos.filter(w=>!['completed','invoiced','cancelled'].includes(w.status));
          const completed = wos.filter(w=>['completed','invoiced'].includes(w.status));
          return (
            <div key={tech} className="bg-white border rounded-lg p-4">
              <h4 className="font-bold text-slate-700 mb-2">{tech}</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-amber-50 rounded p-2"><p className="text-xl font-bold text-amber-700">{active.length}</p><p className="text-xs text-gray-500">Active WOs</p></div>
                <div className="bg-green-50 rounded p-2"><p className="text-xl font-bold text-green-700">{completed.length}</p><p className="text-xs text-gray-500">Completed</p></div>
                <div className="bg-blue-50 rounded p-2"><p className="text-xl font-bold text-blue-700">{wos.length}</p><p className="text-xs text-gray-500">Total</p></div>
              </div>
              <div className="mt-3">
                {active.slice(0,3).map(w=>(
                  <div key={w.id} className="text-xs py-1 border-b last:border-0 flex justify-between">
                    <span className="font-mono">{w.wo_number}</span>
                    <span className="text-gray-500">{w.year} {w.make} {w.model}</span>
                    <Badge label={w.status} color={statusColor(w.status)}/>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {Object.keys(techMap).length===0 && <p className="text-gray-400 text-sm">No technicians with assigned work orders.</p>}
      </div>
    </div>
  );
}

// ─── AI Diagnostics Tab ───────────────────────────────────────────────────────
function AIDiagnosticsTab() {
  const [f, setF] = useState({ year:'2020', make:'', model:'', odometer_km:'', fuel_type:'gasoline', customer_concern:'', inspection_notes:'' });
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const up = (k:string,v:string) => setF(p=>({...p,[k]:v}));

  async function run() {
    if (!f.make || !f.model || !f.customer_concern) return;
    setLoading(true); setResult('');
    try {
      const res = await fetch('/api/admin/auto-repair/ai-diagnosis', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...f, year:parseInt(f.year), odometer_km:f.odometer_km?parseInt(f.odometer_km):null}) });
      const data = await res.json() as { diagnosis:string; fallback?:boolean };
      setResult(data.diagnosis); setIsFallback(data.fallback??false);
    } finally { setLoading(false); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-700">Vehicle & Concern Details</h3>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="text-xs text-gray-500">Year</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.year} onChange={e=>up('year',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Make *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.make} onChange={e=>up('make',e.target.value)} placeholder="Ford"/></div>
          <div><label className="text-xs text-gray-500">Model *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.model} onChange={e=>up('model',e.target.value)} placeholder="F-150"/></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-gray-500">Odometer (km)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.odometer_km} onChange={e=>up('odometer_km',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Fuel Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.fuel_type} onChange={e=>up('fuel_type',e.target.value)}>{FUEL_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        </div>
        <div><label className="text-xs text-gray-500">Customer Concern *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={f.customer_concern} onChange={e=>up('customer_concern',e.target.value)} placeholder="Describe the symptom in detail…"/></div>
        <div><label className="text-xs text-gray-500">Inspection Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={f.inspection_notes} onChange={e=>up('inspection_notes',e.target.value)} placeholder="Any prior inspection findings, codes, observations…"/></div>
        <button onClick={run} disabled={loading||!f.make||!f.model||!f.customer_concern} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{loading?'Analyzing with Llama 3.2…':'Generate AI Diagnostic'}</button>
      </div>
      <div>
        <h3 className="font-semibold text-slate-700 mb-2">Diagnostic Report</h3>
        {isFallback && <div className="mb-2 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-700">AI offline — showing template assessment</div>}
        <div className="bg-gray-50 border rounded-lg p-4 min-h-64 text-sm whitespace-pre-wrap font-mono text-gray-700">{result || <span className="text-gray-400">AI diagnostic report will appear here…</span>}</div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AutoRepairPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData|null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const loadAll = useCallback(async () => {
    const [d, wo, c, v] = await Promise.all([
      fetch('/api/admin/auto-repair').then(r=>r.json()),
      fetch('/api/admin/auto-repair/work-orders').then(r=>r.json()),
      fetch('/api/admin/auto-repair/customers').then(r=>r.json()),
      fetch('/api/admin/auto-repair/vehicles').then(r=>r.json()),
    ]);
    setDash(d); setWorkOrders(Array.isArray(wo)?wo:[]); setCustomers(Array.isArray(c)?c:[]); setVehicles(Array.isArray(v)?v:[]);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
            <span className="text-white text-sm font-bold">AR</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Auto Repair & Mechanic Shop Hub</h1>
            <p className="text-xs text-gray-400">Work orders · Inspections · Parts & Labour · AI Diagnostics — Calgary, AB</p>
          </div>
        </div>
      </div>
      <div className="border-b bg-white px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab===t?'border-blue-600 text-blue-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
          ))}
        </div>
      </div>
      <div className="p-6">
        {tab==='dashboard' && <DashboardTab dash={dash} workOrders={workOrders}/>}
        {tab==='work-orders' && <WorkOrdersTab workOrders={workOrders} customers={customers} vehicles={vehicles} reload={loadAll}/>}
        {tab==='inspection' && <InspectionTab workOrders={workOrders} reload={loadAll}/>}
        {tab==='line-items' && <LineItemsTab workOrders={workOrders}/>}
        {tab==='customers' && <CustomersTab customers={customers} reload={loadAll}/>}
        {tab==='technicians' && <TechniciansTab workOrders={workOrders}/>}
        {tab==='ai-diagnostics' && <AIDiagnosticsTab/>}
      </div>
    </div>
  );
}
