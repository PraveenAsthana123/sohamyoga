'use client';

import { useState, useEffect } from 'react';

interface Client {
  id: number;
  name: string;
  email: string;
  goal: string;
  status: string;
  created_at: string;
}

interface MealPlan {
  id: number;
  client_name: string;
  plan_name: string;
  calories: number;
  start_date: string;
  status: string;
}

export default function DietitianNutritionPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [activeTab, setActiveTab] = useState<'clients' | 'plans' | 'ai'>('clients');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dietitian-nutrition')
      .then(r => r.json())
      .then(d => { setClients(d.clients || []); setMealPlans(d.mealPlans || []); })
      .finally(() => setLoading(false));
  }, []);

  const runAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const d = await res.json();
      setAiResponse(d.text || d.error || 'No response');
    } catch {
      setAiResponse('AI unavailable');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dietitian & Nutrition</h1>
        <p className="text-gray-600 mt-1">Manage nutrition clients, meal plans, and dietary consultations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Clients', value: clients.length, color: 'bg-green-500' },
          { label: 'Active Plans', value: mealPlans.filter(p => p.status === 'active').length, color: 'bg-blue-500' },
          { label: 'Completed Plans', value: mealPlans.filter(p => p.status === 'completed').length, color: 'bg-purple-500' },
          { label: 'Avg Calories', value: mealPlans.length ? Math.round(mealPlans.reduce((s, p) => s + (p.calories || 0), 0) / mealPlans.length) : 0, color: 'bg-orange-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['clients', 'plans', 'ai'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t === 'ai' ? 'AI Nutrition Advice' : t === 'plans' ? 'Meal Plans' : 'Clients'}
          </button>
        ))}
      </div>

      {activeTab === 'clients' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Nutrition Clients</h2>
            <button className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700">+ New Client</button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : clients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No clients yet. Add your first nutrition client.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Email', 'Goal', 'Status', 'Joined'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-gray-600">{c.goal}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'plans' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Meal Plans</h2>
            <button className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700">+ New Plan</button>
          </div>
          {mealPlans.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No meal plans created yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Client', 'Plan Name', 'Calories/Day', 'Start Date', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mealPlans.map(p => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.client_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.plan_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.calories} kcal</td>
                    <td className="px-4 py-3 text-gray-500">{p.start_date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI Nutrition Advisor</h2>
          <textarea
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="Ask about meal planning, macronutrients, dietary restrictions, supplements..."
            className="w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={runAI}
            disabled={aiLoading}
            className="mt-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {aiLoading ? 'Generating...' : 'Get AI Advice'}
          </button>
          {aiResponse && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
