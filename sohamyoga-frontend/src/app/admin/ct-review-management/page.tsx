"use client";
import { useEffect, useState } from "react";

const TABS = ["Overview", "Platform Breakdown", "Response Queue", "AI Advisor"] as const;
type Tab = typeof TABS[number];

interface ReviewData {
  health_score: number;
  avg_rating: number;
  reviews_this_month: number;
  response_rate: number;
  sentiment: number;
  alerts: string[];
  platforms?: { name: string; rating: number; reviews: number; responded: number }[];
  queue?: { id: string; platform: string; reviewer: string; rating: number; text: string; date: string }[];
}

const FALLBACK: ReviewData = {
  health_score: 65,
  avg_rating: 4.1,
  reviews_this_month: 43,
  response_rate: 72,
  sentiment: 78,
  alerts: ["5 reviews awaiting response", "Yelp rating dropped 0.2 points"],
  platforms: [
    { name: "Google", rating: 4.3, reviews: 18, responded: 15 },
    { name: "Yelp", rating: 3.8, reviews: 9, responded: 5 },
    { name: "Trustpilot", rating: 4.5, reviews: 11, responded: 11 },
    { name: "G2", rating: 4.0, reviews: 5, responded: 4 },
  ],
  queue: [
    { id: "1", platform: "Google", reviewer: "Sarah M.", rating: 2, text: "Service was slow and staff seemed inattentive. Expected better.", date: "2026-09-14" },
    { id: "2", platform: "Yelp", reviewer: "James T.", rating: 3, text: "Good location but the app booking was confusing.", date: "2026-09-13" },
    { id: "3", platform: "Google", reviewer: "Anika P.", rating: 4, text: "Great class! Would love more evening slots.", date: "2026-09-12" },
    { id: "4", platform: "Trustpilot", reviewer: "David K.", rating: 5, text: "Absolutely love the instructors. Life changing!", date: "2026-09-11" },
    { id: "5", platform: "Yelp", reviewer: "Mei L.", rating: 2, text: "Cancelled my class last minute without notice.", date: "2026-09-10" },
  ],
};

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-400">
      {"★".repeat(Math.floor(rating))}{"☆".repeat(5 - Math.floor(rating))}
      <span className="text-gray-500 text-xs ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function CtReviewManagementPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [repliedIds, setRepliedIds] = useState<Set<string>>(new Set());
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ct-review-management", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => { setData(d ?? FALLBACK); setLoading(false); });
  }, []);

  const submitReply = (id: string) => {
    setRepliedIds(p => new Set([...p, id]));
  };

  const runAi = async () => {
    if (!aiPrompt.trim() || !data) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Review metrics: avg_rating=${data.avg_rating}, reviews_this_month=${data.reviews_this_month}, response_rate=${data.response_rate}%, sentiment=${data.sentiment}. Question: ${aiPrompt}`,
        }),
      });
      const d = await res.json();
      setAiResult(d.result || d.text || JSON.stringify(d));
    } catch {
      setAiResult("Unable to reach AI service. Please try again.");
    }
    setAiLoading(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  const d = data!;
  const healthColor = d.health_score >= 80 ? "text-green-600 bg-green-100" : d.health_score >= 60 ? "text-yellow-600 bg-yellow-100" : "text-red-600 bg-red-100";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Review Management Control Tower</h1>
        <p className="text-gray-500 mb-6">Monitor and respond to reviews across all platforms</p>

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${tab === t ? "bg-white border border-b-white border-gray-200 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>
              {t}{t === "Response Queue" && d.queue ? ` (${d.queue.filter(q => !repliedIds.has(q.id)).length})` : ""}
            </button>
          ))}
        </div>

        {tab === "Overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-5 gap-4">
              <div className={`${healthColor} rounded-2xl p-6 text-center`}>
                <p className="text-sm mb-1 opacity-70">Health Score</p>
                <p className="text-5xl font-bold">{d.health_score}</p>
                <div className="mt-2 h-2 bg-white bg-opacity-40 rounded-full">
                  <div className="h-2 rounded-full bg-current opacity-60" style={{ width: `${d.health_score}%` }} />
                </div>
              </div>
              <KpiCard label="Avg Rating" value={`${d.avg_rating} ★`} />
              <KpiCard label="Reviews This Month" value={d.reviews_this_month} />
              <KpiCard label="Response Rate" value={`${d.response_rate}%`} />
              <KpiCard label="Sentiment Score" value={`${d.sentiment}%`} sub="positive" />
            </div>
            {d.alerts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-semibold text-amber-800 mb-2">⚠ Alerts</h3>
                {d.alerts.map((a, i) => <p key={i} className="text-sm text-amber-700">• {a}</p>)}
              </div>
            )}
          </div>
        )}

        {tab === "Platform Breakdown" && d.platforms && (
          <div className="space-y-4">
            {d.platforms.map(p => (
              <div key={p.name} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="font-semibold text-gray-800">{p.name}</p>
                    <StarRating rating={p.rating} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{p.reviews} reviews</p>
                    <p className="text-xs text-gray-400">{p.responded} responded</p>
                  </div>
                </div>
                <div className="h-3 bg-gray-100 rounded-full">
                  <div className="h-3 bg-indigo-400 rounded-full transition-all"
                    style={{ width: `${p.reviews > 0 ? Math.round((p.responded / p.reviews) * 100) : 0}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Response rate: {p.reviews > 0 ? Math.round((p.responded / p.reviews) * 100) : 0}%
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === "Response Queue" && d.queue && (
          <div className="space-y-4">
            {d.queue.filter(r => !repliedIds.has(r.id)).length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <p className="text-green-700 font-medium">All reviews responded! Great job.</p>
              </div>
            )}
            {d.queue.filter(r => !repliedIds.has(r.id)).map(r => (
              <div key={r.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full mr-2">{r.platform}</span>
                    <span className="text-sm font-medium text-gray-800">{r.reviewer}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating rating={r.rating} />
                    <span className="text-xs text-gray-400">{r.date}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3 italic">"{r.text}"</p>
                <div className="flex gap-2">
                  <textarea
                    value={replyTexts[r.id] ?? ""}
                    onChange={e => setReplyTexts(p => ({ ...p, [r.id]: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-16"
                    placeholder="Write your response…" />
                  <button onClick={() => submitReply(r.id)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm self-end hover:bg-indigo-700">
                    Reply
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "AI Advisor" && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">AI Review Advisor</h2>
            <p className="text-sm text-gray-500 mb-4">Get AI recommendations for improving your review performance and response strategy.</p>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24 resize-none mb-3"
              placeholder="e.g. How should I respond to 1-star reviews? How can I improve my Yelp rating?" />
            <button onClick={runAi} disabled={aiLoading}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
              {aiLoading ? "Analyzing…" : "Get Advice"}
            </button>
            {aiResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiResult}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
