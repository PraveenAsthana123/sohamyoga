"use client";
import { useState } from "react";

type FAQScope = "class" | "membership" | "ai_feature" | "payment" | "global";

interface FAQItem {
  id: string;
  scope: FAQScope;
  entityId?: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
}

const SEED_FAQS: FAQItem[] = [
  { id: "faq_1", scope: "class", question: "What should I bring to class?", answer: "A yoga mat, water bottle, and towel. Blocks and straps are provided.", displayOrder: 0, isActive: true },
  { id: "faq_2", scope: "class", question: "Can I attend if I am a complete beginner?", answer: "Absolutely! Our Beginner and All Levels classes welcome everyone.", displayOrder: 1, isActive: true },
  { id: "faq_3", scope: "class", question: "What happens if I need to cancel?", answer: "Cancel up to 2 hours before class for a full refund.", displayOrder: 2, isActive: true },
  { id: "faq_4", scope: "membership", question: "Can I switch plans?", answer: "Yes, upgrade or downgrade anytime from account settings.", displayOrder: 0, isActive: true },
  { id: "faq_5", scope: "membership", question: "How does the free trial work?", answer: "7-day free trial on any paid plan. Cancel before it ends and pay nothing.", displayOrder: 1, isActive: true },
  { id: "faq_6", scope: "payment", question: "What payment methods are accepted?", answer: "All major credit/debit cards via Stripe. Bank transfer for annual plans.", displayOrder: 0, isActive: true },
  { id: "faq_7", scope: "ai_feature", question: "How does the AI pose coach work?", answer: "Your webcam captures a pose frame; our AI scores alignment and gives targeted corrections.", displayOrder: 0, isActive: true },
];

const SCOPE_LABELS: Record<FAQScope, string> = {
  class: "Classes",
  membership: "Membership",
  ai_feature: "AI Features",
  payment: "Payments",
  global: "Global",
};

const SCOPE_COLOR: Record<FAQScope, string> = {
  class: "bg-green-100 text-green-700",
  membership: "bg-purple-100 text-purple-700",
  ai_feature: "bg-blue-100 text-blue-700",
  payment: "bg-yellow-100 text-yellow-700",
  global: "bg-gray-100 text-gray-700",
};

export default function AdminFAQPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>(SEED_FAQS);
  const [filter, setFilter] = useState<FAQScope | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ scope: "class" as FAQScope, question: "", answer: "", displayOrder: 0 });

  const filtered = filter === "all" ? faqs : faqs.filter(f => f.scope === filter);

  function saveEdit(id: string, patch: Partial<FAQItem>) {
    setFaqs(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
    setEditingId(null);
  }

  function toggleActive(id: string) {
    setFaqs(prev => prev.map(f => f.id === id ? { ...f, isActive: !f.isActive } : f));
  }

  function deleteFAQ(id: string) {
    setFaqs(prev => prev.filter(f => f.id !== id));
  }

  function addFAQ() {
    if (!draft.question.trim() || !draft.answer.trim()) return;
    const newFAQ: FAQItem = { id: `faq_${Date.now()}`, entityId: undefined, isActive: true, ...draft };
    setFaqs(prev => [...prev, newFAQ]);
    setDraft({ scope: "class", question: "", answer: "", displayOrder: 0 });
    setAdding(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">FAQ Management</h1>
            <p className="text-gray-400 text-sm mt-0.5">Manage FAQs for classes, membership, AI features, and payments</p>
          </div>
          <button onClick={() => setAdding(true)}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            + Add FAQ
          </button>
        </div>

        {/* Scope filter */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-full text-sm ${filter === "all" ? "bg-green-700 text-white" : "bg-gray-800 text-gray-300"}`}>
            All ({faqs.length})
          </button>
          {(Object.keys(SCOPE_LABELS) as FAQScope[]).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm ${filter === s ? "bg-green-700 text-white" : "bg-gray-800 text-gray-300"}`}>
              {SCOPE_LABELS[s]} ({faqs.filter(f => f.scope === s).length})
            </button>
          ))}
        </div>

        {/* Add form */}
        {adding && (
          <div className="bg-gray-900 rounded-2xl p-5 space-y-3 border border-green-700">
            <h3 className="font-semibold text-green-400">New FAQ</h3>
            <select value={draft.scope} onChange={e => setDraft(d => ({ ...d, scope: e.target.value as FAQScope }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm">
              {(Object.entries(SCOPE_LABELS)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="text" value={draft.question} onChange={e => setDraft(d => ({ ...d, question: e.target.value }))}
              placeholder="Question"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-500" />
            <textarea value={draft.answer} onChange={e => setDraft(d => ({ ...d, answer: e.target.value }))}
              placeholder="Answer"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-500 resize-none" rows={3} />
            <div className="flex gap-2">
              <button onClick={addFAQ} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Save</button>
              <button onClick={() => setAdding(false)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {/* FAQ list — one row per item */}
        <div className="space-y-3">
          {filtered.map(faq => (
            <div key={faq.id} className={`bg-gray-900 rounded-2xl p-5 ${!faq.isActive ? "opacity-50" : ""}`}>
              {editingId === faq.id ? (
                <EditFAQForm faq={faq} onSave={patch => saveEdit(faq.id, patch)} onCancel={() => setEditingId(null)} scopeLabels={SCOPE_LABELS} />
              ) : (
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SCOPE_COLOR[faq.scope]}`}>{SCOPE_LABELS[faq.scope]}</span>
                      {!faq.isActive && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-400">Hidden</span>}
                    </div>
                    <p className="font-semibold text-white text-sm">Q: {faq.question}</p>
                    <p className="text-gray-400 text-sm">A: {faq.answer}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setEditingId(faq.id)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors">Edit</button>
                    <button onClick={() => toggleActive(faq.id)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors">
                      {faq.isActive ? "Hide" : "Show"}
                    </button>
                    <button onClick={() => deleteFAQ(faq.id)} className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 rounded-lg text-xs transition-colors">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditFAQForm({ faq, onSave, onCancel, scopeLabels }: {
  faq: FAQItem;
  onSave: (patch: Partial<FAQItem>) => void;
  onCancel: () => void;
  scopeLabels: Record<FAQScope, string>;
}) {
  const [q, setQ] = useState(faq.question);
  const [a, setA] = useState(faq.answer);
  const [scope, setScope] = useState(faq.scope);

  return (
    <div className="space-y-3">
      <select value={scope} onChange={e => setScope(e.target.value as FAQScope)}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm">
        {(Object.entries(scopeLabels)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input value={q} onChange={e => setQ(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm" />
      <textarea value={a} onChange={e => setA(e.target.value)} rows={3}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm resize-none" />
      <div className="flex gap-2">
        <button onClick={() => onSave({ question: q, answer: a, scope })} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Save</button>
        <button onClick={onCancel} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition-colors">Cancel</button>
      </div>
    </div>
  );
}
