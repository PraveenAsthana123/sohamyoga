'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'Entity Extractor' | 'Complaint Classifier' | 'AI Response Studio' | 'Legal Escalation Tracker' | 'Intelligence Dashboard';
const TABS: Tab[] = ['Entity Extractor', 'Complaint Classifier', 'AI Response Studio', 'Legal Escalation Tracker', 'Intelligence Dashboard'];

interface ReviewEntity { id: number; review_text: string; entities: Record<string, unknown>; sentiment: string; topics: string[]; products_mentioned: string[]; staff_mentioned: string[]; created_at: string; }
interface ComplaintClass { id: number; complaint_text: string; category: string; subcategory: string; priority: string; sentiment_score: number; escalation_required: boolean; suggested_response: string; }
interface LegalEscalation { id: number; review_id: string; platform: string; content_excerpt: string; reason: string; status: string; assigned_to: string; resolution: string; created_at: string; }

const SENTIMENT_COLOR: Record<string, string> = { positive: 'bg-green-100 text-green-700', negative: 'bg-red-100 text-red-700', neutral: 'bg-gray-100 text-gray-700', mixed: 'bg-yellow-100 text-yellow-700' };
const PRIORITY_COLOR: Record<string, string> = { low: 'bg-blue-100 text-blue-700', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700' };
const STATUS_COLOR: Record<string, string> = { under_review: 'bg-yellow-100 text-yellow-700', investigating: 'bg-orange-100 text-orange-700', resolved: 'bg-green-100 text-green-700' };

export default function ReviewAIPage() {
  const [tab, setTab] = useState<Tab>('Entity Extractor');
  const [entities, setEntities] = useState<ReviewEntity[]>([]);
  const [complaints, setComplaints] = useState<ComplaintClass[]>([]);
  const [escalations, setEscalations] = useState<LegalEscalation[]>([]);
  const [stats, setStats] = useState<{ total: string }>({ total: '0' });
  const [loading, setLoading] = useState(false);

  // Entity extractor
  const [reviewText, setReviewText] = useState('');
  const [extractResult, setExtractResult] = useState<Record<string, unknown> | null>(null);

  // Complaint classifier
  const [complaintText, setComplaintText] = useState('');
  const [classifyResult, setClassifyResult] = useState<Record<string, unknown> | null>(null);

  // Response studio
  const [responseForm, setResponseForm] = useState({ customer_name: '', rating: 4, review_text: '', business_name: 'Sohamyoga' });
  const [generatedResponse, setGeneratedResponse] = useState<Record<string, unknown> | null>(null);

  const loadData = useCallback(async () => {
    const [rRes, cRes, lRes] = await Promise.all([
      fetch('/api/admin/review-ai'),
      fetch('/api/admin/review-ai/classify'),
      fetch('/api/admin/review-ai/legal'),
    ]);
    if (rRes.ok) { const d = await rRes.json() as { entities: ReviewEntity[]; stats: typeof stats }; setEntities(d.entities || []); setStats(d.stats); }
    if (cRes.ok) setComplaints(await cRes.json() as ComplaintClass[]);
    if (lRes.ok) setEscalations(await lRes.json() as LegalEscalation[]);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const extractEntities = async () => {
    if (!reviewText) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/review-ai/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ review_text: reviewText }) });
      const d = await res.json() as { extraction: Record<string, unknown> };
      setExtractResult(d.extraction);
      await loadData();
    } finally { setLoading(false); }
  };

  const classifyComplaint = async () => {
    if (!complaintText) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/review-ai/classify/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ complaint_text: complaintText }) });
      setClassifyResult(await res.json() as Record<string, unknown>);
    } finally { setLoading(false); }
  };

  const generateResponse = async () => {
    if (!responseForm.review_text) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/review-ai/personalize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(responseForm) });
      setGeneratedResponse(await res.json() as Record<string, unknown>);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Review AI</h1>
        <p className="text-slate-300 text-sm">Entity extraction, complaint classification, AI response personalization & legal escalation management</p>
      </div>

      <div className="bg-white border-b px-6 py-3 flex gap-8">
        <div><span className="text-2xl font-bold text-slate-800">{stats.total}</span><span className="text-gray-500 text-sm ml-1">Reviews Processed</span></div>
        <div><span className="text-2xl font-bold text-slate-800">{complaints.length}</span><span className="text-gray-500 text-sm ml-1">Complaints Classified</span></div>
        <div><span className="text-2xl font-bold text-slate-800">{escalations.filter(e => e.status !== 'resolved').length}</span><span className="text-gray-500 text-sm ml-1">Open Escalations</span></div>
        <div><span className="text-2xl font-bold text-red-600">{complaints.filter(c => c.escalation_required).length}</span><span className="text-gray-500 text-sm ml-1">Require Escalation</span></div>
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
        {/* Entity Extractor */}
        {tab === 'Entity Extractor' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Extract Entities</h2>
              <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
                placeholder="Paste a customer review here..." rows={6}
                className="w-full border rounded px-3 py-2 text-sm mb-3" />
              <button onClick={extractEntities} disabled={loading || !reviewText}
                className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Extracting...' : '🔬 Extract Entities'}
              </button>
              {extractResult && (
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${SENTIMENT_COLOR[(extractResult.sentiment as string) || 'neutral']}`}>{String(extractResult.sentiment || 'neutral')}</span>
                  </div>
                  {(extractResult.topics as string[])?.length > 0 && (
                    <div><p className="text-xs font-medium text-gray-600">Topics</p>
                      <div className="flex flex-wrap gap-1 mt-1">{(extractResult.topics as string[]).map(t => <span key={t} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t}</span>)}</div></div>
                  )}
                  {(extractResult.staff_mentioned as string[])?.length > 0 && (
                    <div><p className="text-xs font-medium text-gray-600">Staff Mentioned</p>
                      <div className="flex gap-1 flex-wrap">{(extractResult.staff_mentioned as string[]).map(s => <span key={s} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{s}</span>)}</div></div>
                  )}
                  <div className="bg-gray-50 rounded p-2"><p className="text-xs font-medium mb-1">Entities JSON</p>
                    <pre className="text-xs text-gray-600 overflow-auto max-h-32">{JSON.stringify(extractResult.entities || extractResult, null, 2)}</pre></div>
                </div>
              )}
            </div>
            <div className="col-span-2 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Processed Reviews ({entities.length})</h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {entities.map(e => (
                  <div key={e.id} className="border rounded p-3">
                    <div className="flex justify-between mb-2">
                      <div className="flex gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded ${SENTIMENT_COLOR[e.sentiment]}`}>{e.sentiment}</span>
                        {e.topics?.slice(0, 3).map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t}</span>)}
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-2">{e.review_text}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      {e.staff_mentioned?.length > 0 && <span>👤 {e.staff_mentioned.join(', ')}</span>}
                      {e.products_mentioned?.length > 0 && <span>📦 {e.products_mentioned.join(', ')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Complaint Classifier */}
        {tab === 'Complaint Classifier' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Classify Complaint</h2>
              <textarea value={complaintText} onChange={e => setComplaintText(e.target.value)}
                placeholder="Paste complaint text..." rows={5} className="w-full border rounded px-3 py-2 text-sm mb-3" />
              <button onClick={classifyComplaint} disabled={loading || !complaintText}
                className="w-full bg-orange-600 text-white py-2 rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                {loading ? 'Classifying...' : '🎯 Classify with AI'}
              </button>
              {classifyResult && (
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{String(classifyResult.category)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_COLOR[String(classifyResult.priority)]}`}>{String(classifyResult.priority)}</span>
                    {!!classifyResult.escalation_required && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">⚠ Escalate</span>}
                  </div>
                  <div className="bg-blue-50 rounded p-3"><p className="text-xs font-bold text-blue-800 mb-1">Suggested Response</p>
                    <p className="text-xs text-gray-700">{String(classifyResult.suggested_response)}</p></div>
                  {(classifyResult.resolution_steps as string[])?.length > 0 && (
                    <div><p className="text-xs font-bold text-gray-700">Resolution Steps</p>
                      {(classifyResult.resolution_steps as string[]).map((s: string, i: number) => <p key={i} className="text-xs text-gray-600">{i + 1}. {s}</p>)}</div>
                  )}
                </div>
              )}
            </div>
            <div className="col-span-2 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Classified Complaints ({complaints.length})</h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {complaints.map(c => (
                  <div key={c.id} className={`border rounded p-3 ${c.escalation_required ? 'border-red-200 bg-red-50' : ''}`}>
                    <div className="flex gap-2 mb-2 flex-wrap">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{c.category} › {c.subcategory}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_COLOR[c.priority]}`}>{c.priority}</span>
                      {c.escalation_required && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">⚠ Escalate</span>}
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-2">{c.complaint_text}</p>
                    {c.suggested_response && <p className="text-xs text-blue-700 mt-1 italic line-clamp-1">Response: {c.suggested_response}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Response Studio */}
        {tab === 'AI Response Studio' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Personalized Response Generator</h2>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-gray-600">Customer Name</label>
                    <input value={responseForm.customer_name} onChange={e => setResponseForm(p => ({ ...p, customer_name: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs font-medium text-gray-600">Star Rating</label>
                    <select value={responseForm.rating} onChange={e => setResponseForm(p => ({ ...p, rating: parseInt(e.target.value) }))} className="w-full mt-1 border rounded px-3 py-2 text-sm">
                      {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} stars</option>)}</select></div>
                </div>
                <div><label className="text-xs font-medium text-gray-600">Business Name</label>
                  <input value={responseForm.business_name} onChange={e => setResponseForm(p => ({ ...p, business_name: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600">Review Text</label>
                  <textarea value={responseForm.review_text} onChange={e => setResponseForm(p => ({ ...p, review_text: e.target.value }))}
                    placeholder="Paste the customer review..." rows={4} className="w-full mt-1 border rounded px-3 py-2 text-sm" /></div>
                <button onClick={generateResponse} disabled={loading || !responseForm.review_text}
                  className="w-full bg-green-600 text-white py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {loading ? 'Generating...' : '✍️ Generate Personalized Response'}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-lg border p-5">
              {!generatedResponse && <p className="text-gray-400 text-center mt-16">Fill in the form and click Generate</p>}
              {generatedResponse && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${SENTIMENT_COLOR[String(generatedResponse.tone)]}`}>{String(generatedResponse.tone)}</span>
                    {!!generatedResponse.ai_generated && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">AI Generated</span>}
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded p-4">
                    <p className="text-xs font-bold text-green-800 mb-2">Generated Response</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{String(generatedResponse.response)}</p>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(String(generatedResponse.response))}
                    className="text-sm text-blue-600 hover:underline">📋 Copy to Clipboard</button>
                  <div className="bg-blue-50 rounded p-3">
                    <p className="text-xs font-bold text-blue-800 mb-1">Next Steps</p>
                    <p className="text-xs text-gray-700">{String(generatedResponse.next_steps)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legal Escalation Tracker */}
        {tab === 'Legal Escalation Tracker' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Total Escalations</p><p className="text-2xl font-bold">{escalations.length}</p></div>
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Under Review</p><p className="text-2xl font-bold text-yellow-600">{escalations.filter(e => e.status === 'under_review').length}</p></div>
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Resolved</p><p className="text-2xl font-bold text-green-700">{escalations.filter(e => e.status === 'resolved').length}</p></div>
            </div>
            <div className="space-y-3">
              {escalations.map(e => (
                <div key={e.id} className={`bg-white border rounded p-4 ${e.status === 'investigating' ? 'border-red-300' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex gap-2 mb-2">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{e.platform}</span>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{e.review_id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[e.status] || 'bg-gray-100'}`}>{e.status}</span>
                      </div>
                      <p className="text-xs text-gray-800 italic mb-1">&quot;{e.content_excerpt}&quot;</p>
                      <p className="text-xs text-red-700 font-medium">Reason: {e.reason}</p>
                      {e.assigned_to && <p className="text-xs text-gray-500 mt-1">Assigned to: {e.assigned_to}</p>}
                      {e.resolution && <p className="text-xs text-green-700 mt-1">Resolution: {e.resolution}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Intelligence Dashboard */}
        {tab === 'Intelligence Dashboard' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              <h2 className="font-semibold text-slate-800">Top Complaint Categories</h2>
              {(() => {
                const cats: Record<string, number> = {};
                complaints.forEach(c => { cats[c.category] = (cats[c.category] || 0) + 1; });
                return Object.entries(cats).sort(([,a],[,b]) => b-a).map(([cat, count]) => (
                  <div key={cat} className="bg-white rounded-lg border p-4 flex items-center gap-4">
                    <div className="flex-1"><p className="font-medium text-sm">{cat}</p>
                      <div className="bg-gray-200 rounded-full h-2 mt-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(count / Math.max(complaints.length, 1)) * 100}%` }} /></div></div>
                    <span className="text-lg font-bold text-slate-800">{count}</span>
                  </div>
                ));
              })()}
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium text-sm text-slate-700 mb-3">Sentiment Distribution</h3>
                {(['positive','neutral','negative','mixed'] as const).map(s => {
                  const count = entities.filter(e => e.sentiment === s).length;
                  return <div key={s} className="flex justify-between items-center py-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${SENTIMENT_COLOR[s]}`}>{s}</span>
                    <span className="font-bold text-sm">{count}</span>
                  </div>;
                })}
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium text-sm text-slate-700 mb-3">Escalation Rate</h3>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600">{complaints.length ? Math.round((complaints.filter(c => c.escalation_required).length / complaints.length) * 100) : 0}%</p>
                  <p className="text-xs text-gray-500">of complaints require escalation</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
