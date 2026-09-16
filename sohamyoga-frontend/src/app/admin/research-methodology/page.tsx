'use client';
import { useEffect, useState } from 'react';

interface Methodology {
  id: number;
  name: string;
  category: string;
  description: string;
  steps: string[];
  tools: string[];
  use_cases: string[];
  estimated_days: number;
  cost_level: string;
}

const CATEGORIES = ['All', 'Qualitative', 'Quantitative', 'Mixed', 'Strategic'];

const CATEGORY_COLORS: Record<string, string> = {
  Qualitative: 'bg-purple-100 text-purple-800',
  Quantitative: 'bg-blue-100 text-blue-800',
  Mixed: 'bg-teal-100 text-teal-800',
  Strategic: 'bg-orange-100 text-orange-800',
};

const COST_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

export default function ResearchMethodologyPage() {
  const [items, setItems] = useState<Methodology[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'All') params.set('category', category);
      if (search) params.set('search', search);
      const r = await fetch(`/api/admin/research-methodology?${params}`);
      const d = await r.json();
      setItems(d.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [category]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const handleAIRecommend = async () => {
    if (!aiQuestion) return;
    setAiLoading(true);
    setAiResult('');
    try {
      const prompt = `You are a research design expert. A researcher has this research question: "${aiQuestion}"\n\nRecommend the top 3 most suitable research methodologies from this list: Surveys, Focus Groups, A/B Testing, Ethnography, Case Studies, Secondary Research, Competitive Analysis, SWOT, Porter's Five Forces, PESTEL, Conjoint Analysis, Delphi Method, Grounded Theory, Longitudinal Study, Cross-sectional Study, Meta-Analysis, Benchmarking, Mystery Shopping, Net Promoter Score, Jobs-to-be-Done.\n\nFor each recommendation, explain: (1) why it fits this research question, (2) key advantages for this context, (3) potential limitations, and (4) estimated timeline. Format clearly with numbered sections.`;
      const r = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const d = await r.json();
      setAiResult(d.response || 'No response');
    } catch {
      setAiResult('AI service unavailable. Check Ollama is running on port 11434.');
    } finally {
      setAiLoading(false);
    }
  };

  const countByCategory = (cat: string) => items.filter(i => i.category === cat).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Research Methodology</h1>
            <p className="text-gray-500 text-sm mt-1">20 research methods for market research and business insights</p>
          </div>
          <button onClick={() => setShowAIModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            AI Recommender
          </button>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${category === cat ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              {cat}
            </button>
          ))}
          <form onSubmit={handleSearch} className="ml-auto flex gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search methodologies..."
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-48"
            />
            <button type="submit" className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200">Search</button>
          </form>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading methodologies...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map(item => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</h3>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${COST_COLORS[item.cost_level] || 'bg-gray-100 text-gray-700'}`}>
                    {item.cost_level}
                  </span>
                </div>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-700'}`}>
                  {item.category}
                </span>
                <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">{item.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{item.estimated_days} days</span>
                  <span>{item.steps?.length || 0} steps</span>
                </div>

                {expanded === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">Steps</div>
                      <ol className="space-y-0.5">
                        {(item.steps || []).map((step, i) => (
                          <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                            <span className="text-gray-400 flex-shrink-0">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">Tools</div>
                      <div className="flex flex-wrap gap-1">
                        {(item.tools || []).map(t => (
                          <span key={t} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">Use Cases</div>
                      <div className="flex flex-wrap gap-1">
                        {(item.use_cases || []).map(u => (
                          <span key={u} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs">{u}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary counts */}
        {!loading && items.length > 0 && (
          <div className="mt-6 flex gap-3 flex-wrap">
            {['Qualitative', 'Quantitative', 'Mixed', 'Strategic'].map(cat => {
              const count = items.filter(i => i.category === cat).length;
              return count > 0 ? (
                <span key={cat} className={`px-3 py-1.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                  {cat}: {count}
                </span>
              ) : null;
            })}
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              Total: {items.length}
            </span>
          </div>
        )}
      </div>

      {/* AI Recommender Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">AI Methodology Recommender</h2>
            <p className="text-sm text-gray-500 mb-4">Describe your research question and the AI will recommend the best methodologies.</p>
            <textarea
              value={aiQuestion}
              onChange={e => setAiQuestion(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
              placeholder="e.g. I want to understand why customers churn from our SaaS product within the first 30 days..."
            />
            <button onClick={handleAIRecommend} disabled={aiLoading} className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 mb-4">
              {aiLoading ? 'Analyzing...' : 'Get Recommendations'}
            </button>
            {aiResult && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-80 overflow-y-auto mb-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{aiResult}</pre>
              </div>
            )}
            <button onClick={() => setShowAIModal(false)} className="w-full bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
