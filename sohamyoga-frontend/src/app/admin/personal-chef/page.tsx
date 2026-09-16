'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','events','clients','recipes','ai-tools','financials'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = {
  dashboard:'Dashboard', events:'Events', clients:'Clients',
  recipes:'Recipe Library', 'ai-tools':'AI Tools', financials:'Financials',
};

const EVENT_TYPES=['meal_prep','dinner_party','weekly_chef','cooking_class','event_catering','corporate_catering','private_dining'];
const EVENT_STATUSES=['inquiry','confirmed','shopping','prep','service','completed','cancelled'];
const RECIPE_CATEGORIES=['appetizer','soup','salad','main_protein','main_vegetarian','side','dessert','breakfast','brunch','sauce','other'];
const DIFFICULTIES=['easy','medium','hard','advanced'];
const SERVICE_TYPES=['meal_prep','dinner_party','weekly_chef','cooking_class','event_catering','corporate_catering','private_dining'];
const FREQUENCIES=['one_time','weekly','bi_weekly','monthly'];

interface DashData{events_this_month:number;upcoming_events_7d:number;revenue_mtd:number;avg_rating:number;signature_recipes_count:number;}
interface ChefClient{id:number;first_name:string;last_name:string;email:string;phone:string;city:string;dietary_restrictions:string[];food_allergies:string[];cuisine_preferences:string[];household_size:number;service_type:string;frequency:string;budget_per_session:number;total_events:number;total_spent:number;}
interface ChefEvent{id:number;client_id:number;event_type:string;event_date:string;start_time:string;end_time:string;guest_count:number;location:string;menu_theme:string;courses:number;dietary_accommodations:string[];status:string;chef_fee:number;grocery_estimate:number;grocery_actual:number;total_billed:number;deposit_paid:number;payment_status:string;client_rating:number;client_feedback:string;first_name:string;last_name:string;dietary_restrictions:string[];food_allergies:string[];}
interface Recipe{id:number;name:string;category:string;cuisine:string;description:string;servings:number;prep_time_minutes:number;cook_time_minutes:number;difficulty:string;dietary_tags:string[];allergens:string[];cost_estimate_per_serving:number;is_signature:boolean;times_served:number;}

function fmtCad(n:number){return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function fmtDate(d:string){return d?new Date(d).toLocaleDateString('en-CA'):'—';}
function Badge({label,color='gray'}:{label:string;color?:string}){
  const m:Record<string,string>={blue:'bg-blue-100 text-blue-700',green:'bg-green-100 text-green-700',amber:'bg-amber-100 text-amber-700',red:'bg-red-100 text-red-700',purple:'bg-purple-100 text-purple-700',gray:'bg-gray-100 text-gray-700',teal:'bg-teal-100 text-teal-700',rose:'bg-rose-100 text-rose-700',orange:'bg-orange-100 text-orange-700',indigo:'bg-indigo-100 text-indigo-700'};
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}
function KpiCard({label,value,sub,color='blue'}:{label:string;value:string|number;sub?:string;color?:string}){
  const b:Record<string,string>={blue:'border-l-4 border-blue-500 bg-blue-50',green:'border-l-4 border-green-500 bg-green-50',amber:'border-l-4 border-amber-500 bg-amber-50',purple:'border-l-4 border-purple-500 bg-purple-50',orange:'border-l-4 border-orange-500 bg-orange-50'};
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]"><div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-slate-800">{title}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button></div>{children}</div></div>;
}
function statusColor(s:string){const m:Record<string,string>={inquiry:'gray',confirmed:'blue',shopping:'purple',prep:'amber',service:'orange',completed:'green',cancelled:'red'};return m[s]??'gray';}
function difficultyColor(d:string){const m:Record<string,string>={easy:'green',medium:'blue',hard:'amber',advanced:'red'};return m[d]??'gray';}

function AddClientModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({first_name:'',last_name:'',email:'',phone:'',address:'',city:'Calgary',dietary_restrictions:'',food_allergies:'',food_preferences:'',cuisine_preferences:'',household_size:'2',service_type:'meal_prep',frequency:'weekly',budget_per_session:'',notes:''});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.first_name||!form.last_name||!form.email)return;
    setSaving(true);
    try{
      await fetch('/api/admin/personal-chef/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        ...form,
        household_size:parseInt(form.household_size)||2,
        budget_per_session:form.budget_per_session?parseFloat(form.budget_per_session):null,
        dietary_restrictions:form.dietary_restrictions?form.dietary_restrictions.split(',').map(s=>s.trim()).filter(Boolean):[],
        food_allergies:form.food_allergies?form.food_allergies.split(',').map(s=>s.trim()).filter(Boolean):[],
        food_preferences:form.food_preferences?form.food_preferences.split(',').map(s=>s.trim()).filter(Boolean):[],
        cuisine_preferences:form.cuisine_preferences?form.cuisine_preferences.split(',').map(s=>s.trim()).filter(Boolean):[],
      })});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title="Add New Client" onClose={onClose}>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e=>f('first_name',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e=>f('last_name',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Email *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e=>f('email',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e=>f('phone',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Address</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.address} onChange={e=>f('address',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e=>f('city',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Household Size</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.household_size} onChange={e=>f('household_size',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Service Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.service_type} onChange={e=>f('service_type',e.target.value)}>{SERVICE_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Frequency</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.frequency} onChange={e=>f('frequency',e.target.value)}>{FREQUENCIES.map(f=><option key={f} value={f}>{f.replace('_',' ')}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Budget/Session ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.budget_per_session} onChange={e=>f('budget_per_session',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Dietary Restrictions (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.dietary_restrictions} onChange={e=>f('dietary_restrictions',e.target.value)} placeholder="gluten_free, dairy_free, vegan…"/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Food Allergies (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.food_allergies} onChange={e=>f('food_allergies',e.target.value)} placeholder="nuts, shellfish…"/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Cuisine Preferences (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.cuisine_preferences} onChange={e=>f('cuisine_preferences',e.target.value)} placeholder="Italian, Asian, Mediterranean…"/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)}/></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving||!form.first_name||!form.last_name||!form.email} className="px-4 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50">{saving?'Saving…':'Add Client'}</button></div>
  </Modal>;
}

function AddEventModal({clients,onClose,onSaved}:{clients:ChefClient[];onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({client_id:'',event_type:'dinner_party',event_date:'',start_time:'',end_time:'',guest_count:'4',location:'',menu_theme:'',courses:'3',dietary_accommodations:'',special_requests:'',chef_fee:'',grocery_estimate:'',deposit_paid:'0'});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.client_id||!form.event_date)return;
    setSaving(true);
    try{
      await fetch('/api/admin/personal-chef/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        ...form,
        client_id:parseInt(form.client_id),
        guest_count:parseInt(form.guest_count)||1,
        courses:parseInt(form.courses)||3,
        chef_fee:form.chef_fee?parseFloat(form.chef_fee):null,
        grocery_estimate:form.grocery_estimate?parseFloat(form.grocery_estimate):null,
        deposit_paid:parseFloat(form.deposit_paid)||0,
        dietary_accommodations:form.dietary_accommodations?form.dietary_accommodations.split(',').map(s=>s.trim()).filter(Boolean):[],
      })});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title="Add Event" onClose={onClose}>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e=>f('client_id',e.target.value)}><option value="">— Select client —</option>{clients.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Event Type *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.event_type} onChange={e=>f('event_type',e.target.value)}>{EVENT_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.event_date} onChange={e=>f('event_date',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Start Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.start_time} onChange={e=>f('start_time',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">End Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.end_time} onChange={e=>f('end_time',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Guest Count</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.guest_count} onChange={e=>f('guest_count',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Courses</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.courses} onChange={e=>f('courses',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Location</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.location} onChange={e=>f('location',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Menu Theme</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.menu_theme} onChange={e=>f('menu_theme',e.target.value)} placeholder="Mediterranean Summer"/></div>
      <div><label className="text-xs text-gray-500">Chef Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.chef_fee} onChange={e=>f('chef_fee',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Grocery Estimate ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.grocery_estimate} onChange={e=>f('grocery_estimate',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Deposit Paid ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.deposit_paid} onChange={e=>f('deposit_paid',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Dietary Accommodations (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.dietary_accommodations} onChange={e=>f('dietary_accommodations',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Special Requests</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.special_requests} onChange={e=>f('special_requests',e.target.value)}/></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving||!form.client_id||!form.event_date} className="px-4 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50">{saving?'Saving…':'Add Event'}</button></div>
  </Modal>;
}

function CompleteEventModal({event,onClose,onSaved}:{event:ChefEvent;onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({grocery_actual:String(event.grocery_estimate||0),total_billed:String((event.chef_fee||0)+(event.grocery_estimate||0)),client_rating:'5',client_feedback:''});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    setSaving(true);
    try{
      await fetch(`/api/admin/personal-chef/events/${event.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grocery_actual:parseFloat(form.grocery_actual)||null,total_billed:parseFloat(form.total_billed)||null,client_rating:parseInt(form.client_rating)||null,client_feedback:form.client_feedback||null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title={`Complete Event: ${event.first_name} ${event.last_name}`} onClose={onClose}>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="text-xs text-gray-500">Actual Grocery Cost ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.grocery_actual} onChange={e=>f('grocery_actual',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Total Billed to Client ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.total_billed} onChange={e=>f('total_billed',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Client Rating</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_rating} onChange={e=>f('client_rating',e.target.value)}><option value="">—</option>{[5,4,3,2,1].map(n=><option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Client Feedback</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.client_feedback} onChange={e=>f('client_feedback',e.target.value)}/></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">{saving?'Completing…':'Complete Event'}</button></div>
  </Modal>;
}

function AddRecipeModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({name:'',category:'main_protein',cuisine:'',description:'',servings:'4',prep_time_minutes:'',cook_time_minutes:'',difficulty:'medium',dietary_tags:'',allergens:'',instructions:'',cost_estimate_per_serving:'',is_signature:false});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string|boolean)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.name)return;
    setSaving(true);
    try{
      await fetch('/api/admin/personal-chef/recipes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        ...form,
        servings:parseInt(form.servings)||4,
        prep_time_minutes:form.prep_time_minutes?parseInt(form.prep_time_minutes):null,
        cook_time_minutes:form.cook_time_minutes?parseInt(form.cook_time_minutes):null,
        cost_estimate_per_serving:form.cost_estimate_per_serving?parseFloat(form.cost_estimate_per_serving):null,
        dietary_tags:form.dietary_tags?form.dietary_tags.split(',').map(s=>s.trim()).filter(Boolean):[],
        allergens:form.allergens?form.allergens.split(',').map(s=>s.trim()).filter(Boolean):[],
      })});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title="Add Recipe" onClose={onClose}>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><label className="text-xs text-gray-500">Recipe Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e=>f('name',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.category} onChange={e=>f('category',e.target.value)}>{RECIPE_CATEGORIES.map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Cuisine</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.cuisine} onChange={e=>f('cuisine',e.target.value)} placeholder="French, Italian…"/></div>
      <div><label className="text-xs text-gray-500">Servings</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.servings} onChange={e=>f('servings',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Difficulty</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.difficulty} onChange={e=>f('difficulty',e.target.value)}>{DIFFICULTIES.map(d=><option key={d}>{d}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Prep Time (min)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.prep_time_minutes} onChange={e=>f('prep_time_minutes',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Cook Time (min)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.cook_time_minutes} onChange={e=>f('cook_time_minutes',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Cost/Serving ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.cost_estimate_per_serving} onChange={e=>f('cost_estimate_per_serving',e.target.value)}/></div>
      <div className="flex items-center gap-2 pt-4"><input type="checkbox" checked={form.is_signature as boolean} onChange={e=>f('is_signature',e.target.checked)}/><label className="text-sm">Signature Recipe</label></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.description} onChange={e=>f('description',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Dietary Tags (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.dietary_tags} onChange={e=>f('dietary_tags',e.target.value)} placeholder="vegan, gluten_free…"/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Allergens (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.allergens} onChange={e=>f('allergens',e.target.value)} placeholder="nuts, dairy…"/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Instructions</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={4} value={form.instructions} onChange={e=>f('instructions',e.target.value)}/></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving||!form.name} className="px-4 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50">{saving?'Saving…':'Add Recipe'}</button></div>
  </Modal>;
}

export default function PersonalChefPage() {
  const [tab, setTab]=useState<Tab>('dashboard');
  const [dash, setDash]=useState<DashData|null>(null);
  const [clients, setClients]=useState<ChefClient[]>([]);
  const [events, setEvents]=useState<ChefEvent[]>([]);
  const [recipes, setRecipes]=useState<Recipe[]>([]);
  const [statusFilter, setStatusFilter]=useState('');
  const [catFilter, setCatFilter]=useState('');
  const [serviceTypeFilter, setServiceTypeFilter]=useState('');
  const [showAddClient, setShowAddClient]=useState(false);
  const [showAddEvent, setShowAddEvent]=useState(false);
  const [showAddRecipe, setShowAddRecipe]=useState(false);
  const [completeEvent, setCompleteEvent]=useState<ChefEvent|null>(null);
  // AI tools
  const [aiTool, setAiTool]=useState<'menu'|'recipe'>('menu');
  const [menuForm, setMenuForm]=useState({event_type:'dinner_party',guest_count:'4',dietary_restrictions:'',food_allergies:'',cuisine_preferences:'',budget_per_person:'80',menu_theme:'Seasonal',courses:'3'});
  const [recipeForm, setRecipeForm]=useState({dish_name:'',servings:'4'});
  const [aiOutput, setAiOutput]=useState('');
  const [aiLoading, setAiLoading]=useState(false);

  const loadDash=useCallback(async()=>{const r=await fetch('/api/admin/personal-chef');if(r.ok)setDash(await r.json());},[]);
  const loadClients=useCallback(async()=>{const r=await fetch(`/api/admin/personal-chef/clients?service_type=${serviceTypeFilter}`);if(r.ok)setClients(await r.json());},[serviceTypeFilter]);
  const loadEvents=useCallback(async()=>{const r=await fetch(`/api/admin/personal-chef/events?status=${statusFilter}`);if(r.ok)setEvents(await r.json());},[statusFilter]);
  const loadRecipes=useCallback(async()=>{const r=await fetch(`/api/admin/personal-chef/recipes?category=${catFilter}`);if(r.ok)setRecipes(await r.json());},[catFilter]);

  useEffect(()=>{loadDash();},[loadDash]);
  useEffect(()=>{if(tab==='clients')loadClients();},[tab,loadClients]);
  useEffect(()=>{if(tab==='events')loadEvents();},[tab,loadEvents]);
  useEffect(()=>{if(tab==='recipes')loadRecipes();},[tab,loadRecipes]);

  async function changeEventStatus(id:number, status:string){
    await fetch(`/api/admin/personal-chef/events/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
    loadEvents();
  }

  async function generateAI(){
    setAiLoading(true);setAiOutput('');
    try{
      const url=aiTool==='menu'?'/api/admin/personal-chef/ai-menu':'/api/admin/personal-chef/ai-recipe';
      const body=aiTool==='menu'?{...menuForm,guest_count:parseInt(menuForm.guest_count)||4,courses:parseInt(menuForm.courses)||3,budget_per_person:parseFloat(menuForm.budget_per_person)||80,dietary_restrictions:menuForm.dietary_restrictions?menuForm.dietary_restrictions.split(',').map(s=>s.trim()).filter(Boolean):[],food_allergies:menuForm.food_allergies?menuForm.food_allergies.split(',').map(s=>s.trim()).filter(Boolean):[],cuisine_preferences:menuForm.cuisine_preferences?menuForm.cuisine_preferences.split(',').map(s=>s.trim()).filter(Boolean):[]}:{...recipeForm,servings:parseInt(recipeForm.servings)||4};
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const d=await r.json() as {menu?:string;recipe?:string};
      setAiOutput(d.menu||d.recipe||'No output');
    }finally{setAiLoading(false);}
  }

  // Group events by status for Kanban
  const kanbanCols = EVENT_STATUSES.map(s=>({status:s,events:events.filter(e=>e.status===s)}));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800">Personal Chef & Private Catering Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Events · Clients · Recipe Library · AI Menu & Recipe Generator — Calgary, AB</p>
      </div>
      <div className="bg-white border-b px-6">
        <nav className="flex gap-1">
          {TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab===t?'border-orange-600 text-orange-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}
        </nav>
      </div>
      <div className="p-6">

        {/* ── DASHBOARD ── */}
        {tab==='dashboard'&&(
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard label="Events This Month" value={dash?.events_this_month??'…'} color="blue"/>
              <KpiCard label="Upcoming (7 days)" value={dash?.upcoming_events_7d??'…'} color="amber"/>
              <KpiCard label="Revenue MTD" value={dash?fmtCad(dash.revenue_mtd):'…'} color="green"/>
              <KpiCard label="Avg Client Rating" value={dash?`${dash.avg_rating}/5.0`:'…'} color="purple"/>
              <KpiCard label="Signature Recipes" value={dash?.signature_recipes_count??'…'} color="orange"/>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <h2 className="font-semibold text-slate-700 mb-3">Event Pipeline Overview</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {kanbanCols.filter(c=>c.events.length>0||['inquiry','confirmed','shopping'].includes(c.status)).map(col=>(
                  <div key={col.status} className="min-w-48 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2"><span className="text-xs font-semibold text-gray-500 uppercase">{col.status}</span><span className="bg-gray-100 text-gray-600 text-xs rounded-full px-1.5">{col.events.length}</span></div>
                    {col.events.slice(0,3).map(e=><div key={e.id} className="bg-gray-50 border rounded-lg p-2 mb-2 text-xs"><p className="font-medium">{e.first_name} {e.last_name}</p><p className="text-gray-500">{e.event_type.replace(/_/g,' ')} · {e.guest_count} guests</p><p className="text-gray-400">{fmtDate(e.event_date)}</p></div>)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── EVENTS ── */}
        {tab==='events'&&(
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <select className="border rounded px-2 py-1.5 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All Statuses</option>{EVENT_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select>
              <button onClick={loadEvents} className="px-3 py-1.5 bg-gray-100 border rounded text-sm hover:bg-gray-200">Filter</button>
              <button onClick={()=>{loadClients();setShowAddEvent(true);}} className="ml-auto px-4 py-1.5 bg-orange-600 text-white rounded text-sm hover:bg-orange-700">+ Add Event</button>
            </div>
            <div className="grid gap-3">
              {events.map(e=>(
                <div key={e.id} className="bg-white border rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{e.first_name} {e.last_name}</span>
                        <Badge label={e.event_type} color="orange"/>
                        <Badge label={e.status} color={statusColor(e.status)}/>
                        {e.client_rating&&<span className="text-amber-500 text-sm">{'★'.repeat(e.client_rating)}</span>}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{fmtDate(e.event_date)} {e.start_time&&`· ${e.start_time}–${e.end_time||'?'}`} · {e.guest_count} guests {e.location&&`· ${e.location}`}</p>
                      {e.menu_theme&&<p className="text-xs text-gray-400">Theme: {e.menu_theme} · {e.courses}-course</p>}
                      {(e.dietary_accommodations?.length>0||e.food_allergies?.length>0)&&<p className="text-xs text-amber-600">Dietary: {[...(e.dietary_accommodations||[]),...(e.food_allergies||[])].join(', ')}</p>}
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        {e.chef_fee&&<span>Chef fee: {fmtCad(e.chef_fee)}</span>}
                        {e.grocery_estimate&&<span>Groceries est: {fmtCad(e.grocery_estimate)}</span>}
                        {e.grocery_actual&&<span>Groceries actual: {fmtCad(e.grocery_actual)}</span>}
                        {e.total_billed&&<span className="font-medium text-green-700">Billed: {fmtCad(e.total_billed)}</span>}
                        {e.deposit_paid>0&&<span>Deposit: {fmtCad(e.deposit_paid)}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 ml-4 items-end">
                      {e.status==='inquiry'&&<button onClick={()=>changeEventStatus(e.id,'confirmed')} className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs hover:bg-blue-100">Confirm</button>}
                      {e.status==='confirmed'&&<button onClick={()=>changeEventStatus(e.id,'shopping')} className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs hover:bg-purple-100">Start Shopping</button>}
                      {e.status==='shopping'&&<button onClick={()=>changeEventStatus(e.id,'prep')} className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs hover:bg-amber-100">Begin Prep</button>}
                      {e.status==='prep'&&<button onClick={()=>changeEventStatus(e.id,'service')} className="px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded text-xs hover:bg-orange-100">In Service</button>}
                      {e.status==='service'&&<button onClick={()=>setCompleteEvent(e)} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Complete</button>}
                      {!['completed','cancelled'].includes(e.status)&&<button onClick={()=>changeEventStatus(e.id,'cancelled')} className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs hover:bg-red-100">Cancel</button>}
                    </div>
                  </div>
                  {e.client_feedback&&<p className="mt-2 text-xs text-gray-500 italic border-t pt-2">&ldquo;{e.client_feedback}&rdquo;</p>}
                </div>
              ))}
              {events.length===0&&<div className="bg-white border rounded-xl p-8 text-center text-gray-400">No events found</div>}
            </div>
          </div>
        )}

        {/* ── CLIENTS ── */}
        {tab==='clients'&&(
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <select className="border rounded px-2 py-1.5 text-sm" value={serviceTypeFilter} onChange={e=>setServiceTypeFilter(e.target.value)}><option value="">All Service Types</option>{SERVICE_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select>
              <button onClick={loadClients} className="px-3 py-1.5 bg-gray-100 border rounded text-sm hover:bg-gray-200">Filter</button>
              <button onClick={()=>setShowAddClient(true)} className="ml-auto px-4 py-1.5 bg-orange-600 text-white rounded text-sm hover:bg-orange-700">+ Add Client</button>
            </div>
            <div className="grid gap-3">
              {clients.map(c=>(
                <div key={c.id} className="bg-white border rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{c.first_name} {c.last_name}</span>
                        <Badge label={c.service_type} color="orange"/>
                        <Badge label={c.frequency} color="gray"/>
                        {c.household_size&&<Badge label={`${c.household_size} people`} color="blue"/>}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{c.email} {c.phone&&`· ${c.phone}`} · {c.city}</p>
                      {c.dietary_restrictions?.length>0&&<div className="flex gap-1 flex-wrap mt-1">{c.dietary_restrictions.map(d=><Badge key={d} label={d} color="teal"/>)}</div>}
                      {c.food_allergies?.length>0&&<div className="flex gap-1 flex-wrap mt-1">{c.food_allergies.map(a=><Badge key={a} label={`⚠ ${a}`} color="red"/>)}</div>}
                      {c.cuisine_preferences?.length>0&&<p className="text-xs text-gray-400 mt-1">Cuisines: {c.cuisine_preferences.join(', ')}</p>}
                    </div>
                    <div className="text-right">
                      {c.budget_per_session&&<p className="font-medium text-sm">{fmtCad(c.budget_per_session)}/session</p>}
                      <p className="text-gray-400 text-xs">{c.total_events} events · {fmtCad(c.total_spent)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {clients.length===0&&<div className="bg-white border rounded-xl p-8 text-center text-gray-400">No clients found</div>}
            </div>
          </div>
        )}

        {/* ── RECIPE LIBRARY ── */}
        {tab==='recipes'&&(
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <select className="border rounded px-2 py-1.5 text-sm" value={catFilter} onChange={e=>setCatFilter(e.target.value)}><option value="">All Categories</option>{RECIPE_CATEGORIES.map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}</select>
              <button onClick={loadRecipes} className="px-3 py-1.5 bg-gray-100 border rounded text-sm hover:bg-gray-200">Filter</button>
              <button onClick={()=>setShowAddRecipe(true)} className="ml-auto px-4 py-1.5 bg-orange-600 text-white rounded text-sm hover:bg-orange-700">+ Add Recipe</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.map(r=>(
                <div key={r.id} className="bg-white border rounded-xl p-4 relative">
                  {r.is_signature&&<span className="absolute top-3 right-3 text-amber-400 text-lg" title="Signature Recipe">★</span>}
                  <div className="pr-6">
                    <h3 className="font-semibold text-slate-800">{r.name}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge label={r.category} color="orange"/>
                      {r.cuisine&&<Badge label={r.cuisine} color="gray"/>}
                      <Badge label={r.difficulty} color={difficultyColor(r.difficulty)}/>
                    </div>
                    {r.description&&<p className="text-xs text-gray-500 mt-2 line-clamp-2">{r.description}</p>}
                    <div className="flex gap-3 mt-2 text-xs text-gray-400">
                      {r.prep_time_minutes&&<span>Prep: {r.prep_time_minutes}m</span>}
                      {r.cook_time_minutes&&<span>Cook: {r.cook_time_minutes}m</span>}
                      <span>Serves {r.servings}</span>
                      {r.cost_estimate_per_serving&&<span>{fmtCad(r.cost_estimate_per_serving)}/serve</span>}
                    </div>
                    {r.dietary_tags?.length>0&&<div className="flex gap-1 flex-wrap mt-2">{r.dietary_tags.map(t=><Badge key={t} label={t} color="teal"/>)}</div>}
                    {r.allergens?.length>0&&<div className="flex gap-1 flex-wrap mt-1">{r.allergens.map(a=><Badge key={a} label={`⚠ ${a}`} color="rose"/>)}</div>}
                    <p className="text-xs text-gray-400 mt-2">Served {r.times_served}x</p>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button onClick={async()=>{if(confirm('Delete this recipe?')){await fetch(`/api/admin/personal-chef/recipes/${r.id}`,{method:'DELETE'});loadRecipes();}}} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                  </div>
                </div>
              ))}
              {recipes.length===0&&<div className="col-span-3 bg-white border rounded-xl p-8 text-center text-gray-400">No recipes yet</div>}
            </div>
          </div>
        )}

        {/* ── AI TOOLS ── */}
        {tab==='ai-tools'&&(
          <div className="max-w-3xl space-y-4">
            <div className="flex gap-2 mb-2">
              <button onClick={()=>{setAiTool('menu');setAiOutput('');}} className={`px-4 py-2 rounded text-sm font-medium ${aiTool==='menu'?'bg-orange-600 text-white':'bg-white border hover:bg-gray-50'}`}>Menu Generator</button>
              <button onClick={()=>{setAiTool('recipe');setAiOutput('');}} className={`px-4 py-2 rounded text-sm font-medium ${aiTool==='recipe'?'bg-orange-600 text-white':'bg-white border hover:bg-gray-50'}`}>Recipe Writer</button>
            </div>
            <div className="bg-white border rounded-xl p-5">
              {aiTool==='menu'&&(
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-700">Personalized Menu Generator</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-gray-500">Event Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={menuForm.event_type} onChange={e=>setMenuForm(p=>({...p,event_type:e.target.value}))}>{EVENT_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
                    <div><label className="text-xs text-gray-500">Guest Count</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={menuForm.guest_count} onChange={e=>setMenuForm(p=>({...p,guest_count:e.target.value}))}/></div>
                    <div><label className="text-xs text-gray-500">Budget/Person ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={menuForm.budget_per_person} onChange={e=>setMenuForm(p=>({...p,budget_per_person:e.target.value}))}/></div>
                    <div><label className="text-xs text-gray-500">Courses</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={menuForm.courses} onChange={e=>setMenuForm(p=>({...p,courses:e.target.value}))}/></div>
                    <div><label className="text-xs text-gray-500">Menu Theme</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={menuForm.menu_theme} onChange={e=>setMenuForm(p=>({...p,menu_theme:e.target.value}))}/></div>
                    <div><label className="text-xs text-gray-500">Cuisine Preferences</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={menuForm.cuisine_preferences} onChange={e=>setMenuForm(p=>({...p,cuisine_preferences:e.target.value}))}/></div>
                    <div><label className="text-xs text-gray-500">Dietary Restrictions</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={menuForm.dietary_restrictions} onChange={e=>setMenuForm(p=>({...p,dietary_restrictions:e.target.value}))}/></div>
                    <div><label className="text-xs text-gray-500">Food Allergies</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={menuForm.food_allergies} onChange={e=>setMenuForm(p=>({...p,food_allergies:e.target.value}))}/></div>
                  </div>
                </div>
              )}
              {aiTool==='recipe'&&(
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-700">Professional Recipe Writer</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><label className="text-xs text-gray-500">Dish Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={recipeForm.dish_name} onChange={e=>setRecipeForm(p=>({...p,dish_name:e.target.value}))}/></div>
                    <div><label className="text-xs text-gray-500">Servings</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={recipeForm.servings} onChange={e=>setRecipeForm(p=>({...p,servings:e.target.value}))}/></div>
                  </div>
                </div>
              )}
              <button onClick={generateAI} disabled={aiLoading||(aiTool==='recipe'&&!recipeForm.dish_name)} className="mt-4 w-full py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50">{aiLoading?'Generating with AI…':`Generate ${aiTool==='menu'?'Menu':'Recipe'}`}</button>
              {aiOutput&&<div className="mt-4 p-4 bg-slate-50 border rounded-lg"><pre className="text-xs whitespace-pre-wrap font-mono text-slate-700">{aiOutput}</pre></div>}
            </div>
          </div>
        )}

        {/* ── FINANCIALS ── */}
        {tab==='financials'&&(
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border rounded-xl p-4">
                <h3 className="font-semibold text-slate-700 mb-3">P&L by Event (Completed)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b"><tr><th className="text-left pb-2 text-xs text-gray-500">Client</th><th className="text-left pb-2 text-xs text-gray-500">Date</th><th className="text-right pb-2 text-xs text-gray-500">Chef Fee</th><th className="text-right pb-2 text-xs text-gray-500">Groceries</th><th className="text-right pb-2 text-xs text-gray-500">Billed</th><th className="text-right pb-2 text-xs text-gray-500">Profit</th></tr></thead>
                    <tbody>
                      {events.filter(e=>e.status==='completed').map(e=>{
                        const cost=(parseFloat(String(e.grocery_actual||e.grocery_estimate||0)));
                        const profit=(parseFloat(String(e.total_billed||0)))-cost;
                        return <tr key={e.id} className="border-b last:border-0">
                          <td className="py-1.5">{e.first_name} {e.last_name}</td>
                          <td className="py-1.5 text-xs text-gray-400">{fmtDate(e.event_date)}</td>
                          <td className="py-1.5 text-right">{e.chef_fee?fmtCad(e.chef_fee):'—'}</td>
                          <td className="py-1.5 text-right">{fmtCad(cost)}</td>
                          <td className="py-1.5 text-right">{e.total_billed?fmtCad(e.total_billed):'—'}</td>
                          <td className={`py-1.5 text-right font-medium ${profit>=0?'text-green-600':'text-red-600'}`}>{fmtCad(profit)}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                  {events.filter(e=>e.status==='completed').length===0&&<p className="text-xs text-gray-400 text-center py-4">No completed events — load Events tab first</p>}
                </div>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <h3 className="font-semibold text-slate-700 mb-3">Upcoming Revenue Pipeline</h3>
                {events.filter(e=>!['completed','cancelled'].includes(e.status)).map(e=>(
                  <div key={e.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div><p className="text-sm font-medium">{e.first_name} {e.last_name}</p><p className="text-xs text-gray-400">{fmtDate(e.event_date)} · <Badge label={e.status} color={statusColor(e.status)}/></p></div>
                    <div className="text-right"><p className="text-sm font-medium">{e.chef_fee?fmtCad(e.chef_fee):'TBD'}</p>{e.deposit_paid>0&&<p className="text-xs text-green-600">-{fmtCad(e.deposit_paid)} deposit</p>}</div>
                  </div>
                ))}
                {events.filter(e=>!['completed','cancelled'].includes(e.status)).length===0&&<p className="text-xs text-gray-400">No upcoming events</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {showAddClient&&<AddClientModal onClose={()=>setShowAddClient(false)} onSaved={()=>{setShowAddClient(false);loadClients();}}/>}
      {showAddEvent&&<AddEventModal clients={clients} onClose={()=>setShowAddEvent(false)} onSaved={()=>{setShowAddEvent(false);loadEvents();}}/>}
      {showAddRecipe&&<AddRecipeModal onClose={()=>setShowAddRecipe(false)} onSaved={()=>{setShowAddRecipe(false);loadRecipes();}}/>}
      {completeEvent&&<CompleteEventModal event={completeEvent} onClose={()=>setCompleteEvent(null)} onSaved={()=>{setCompleteEvent(null);loadEvents();loadDash();}}/>}
    </div>
  );
}
