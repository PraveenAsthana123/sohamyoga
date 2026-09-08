"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CHANNELS = ["email", "whatsapp", "sms", "push", "in_app", "social"];
const CHANNEL_ICON: Record<string, string> = { email: "📧", whatsapp: "💬", sms: "📱", push: "🔔", in_app: "🏠", social: "📲" };

// Real event types this product actually emits (journey_touchpoint_type
// enum) -- an Event Trigger campaign fires against one of these, never a
// fabricated event name with nothing behind it.
const TRIGGER_EVENTS = [
  { v: "form_submission", l: "Form submitted" },
  { v: "event_registration", l: "Event registration" },
  { v: "booking", l: "Class booked" },
  { v: "campaign_email", l: "Campaign email opened" },
  { v: "landing_page_view", l: "Landing page viewed" },
  { v: "survey_response", l: "Survey response submitted" },
];

const STEPS = ["Details", "Audience", "Content", "Schedule", "Review"];

interface Segment { id: string; name: string; size: number }

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [generating, setGenerating] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "one_time",
    channels: [] as string[],
    triggerEvent: "",
    audienceSegmentId: "",
    goalType: "membership_conversions",
    goalTarget: 50,
    subject: "",
    body: "",
    aiGenerated: false,
    couponCode: "",
    scheduledAt: "",
    isImmediate: true,
  });

  useEffect(() => {
    fetch("/api/lifecycle-campaigns/segments", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null).then(d => setSegments(d?.segments ?? []));
  }, []);

  function toggleChannel(ch: string) {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter(c => c !== ch) : [...f.channels, ch],
    }));
  }

  async function generateWithAi() {
    if (!form.name.trim()) return;
    setGenerating(true);
    const res = await fetch("/api/lifecycle-campaigns/generate-content", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: `${form.name}${form.description ? ` — ${form.description}` : ""}` }),
    });
    const data = await res.json().catch(() => ({}));
    setGenerating(false);
    if (!res.ok) { setError(data.error ?? "Failed to generate content."); return; }
    setForm(f => ({ ...f, subject: data.subject, body: data.body, aiGenerated: true }));
  }

  async function launchCampaign() {
    setLaunching(true); setError("");
    const res = await fetch("/api/lifecycle-campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, type: form.type, channels: form.channels,
        triggerEvent: form.type === "trigger" ? form.triggerEvent : undefined,
        audienceLabel: selectedSegment?.name, audienceSize: selectedSegment?.size,
        goalType: form.goalType, goalTarget: form.goalTarget,
        isImmediate: form.isImmediate, scheduledAt: form.scheduledAt,
        subject: form.subject, body: form.body,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLaunching(false);
    if (!res.ok) { setError(data.error ?? "Failed to launch campaign."); return; }
    router.push("/admin/campaigns");
  }

  function canProceed(): boolean {
    if (step === 0) return !!form.name.trim() && form.channels.length > 0 && (form.type !== "trigger" || !!form.triggerEvent);
    if (step === 1) return !!form.audienceSegmentId;
    if (step === 2) return !!form.body.trim();
    return true;
  }

  const selectedSegment = segments.find(s => s.id === form.audienceSegmentId);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm mb-2">← Back</button>
          <h1 className="text-2xl font-bold">New Campaign</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? "bg-green-600" : i === step ? "bg-white text-gray-900" : "bg-gray-700 text-gray-400"
              }`}>{i < step ? "✓" : i + 1}</div>
              <span className={`hidden sm:block mx-2 text-xs ${i === step ? "text-white" : "text-gray-500"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`w-6 h-0.5 ${i < step ? "bg-green-600" : "bg-gray-700"}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-gray-900 rounded-2xl p-6 space-y-4">

          {/* Step 0: Details */}
          {step === 0 && (
            <>
              <h2 className="font-semibold text-gray-200">Campaign Details</h2>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Campaign name"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500" />
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description (optional)"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 resize-none" rows={2} />

              <div>
                <label className="text-sm text-gray-400 block mb-2">Campaign Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: "one_time", l: "One-time Blast" },
                    { v: "drip", l: "Drip Sequence" },
                    { v: "trigger", l: "Event Trigger" },
                    { v: "ab_test", l: "A/B Test" },
                    { v: "referral", l: "Referral" },
                    { v: "retargeting", l: "Retargeting" },
                  ].map(t => (
                    <button key={t.v} onClick={() => setForm(f => ({ ...f, type: t.v }))}
                      className={`py-2 px-3 rounded-lg text-xs transition-colors ${
                        form.type === t.v ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}>{t.l}</button>
                  ))}
                </div>
              </div>

              {form.type === "trigger" && (
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Fires when…</label>
                  <select value={form.triggerEvent} onChange={e => setForm(f => ({ ...f, triggerEvent: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm">
                    <option value="">Select a real event…</option>
                    {TRIGGER_EVENTS.map(te => <option key={te.v} value={te.v}>{te.l}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm text-gray-400 block mb-2">Channels</label>
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map(ch => (
                    <button key={ch} onClick={() => toggleChannel(ch)}
                      className={`px-3 py-2 rounded-xl text-sm transition-colors ${
                        form.channels.includes(ch) ? "bg-green-700 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}>{CHANNEL_ICON[ch]} {ch}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Goal</label>
                <div className="flex gap-3">
                  <select value={form.goalType} onChange={e => setForm(f => ({ ...f, goalType: e.target.value }))}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm">
                    <option value="membership_conversions">Membership Conversions</option>
                    <option value="class_bookings">Class Bookings</option>
                    <option value="referrals">Referrals</option>
                    <option value="re_engagement">Re-engagement</option>
                    <option value="awareness">Awareness</option>
                  </select>
                  <input type="number" value={form.goalTarget} min={1}
                    onChange={e => setForm(f => ({ ...f, goalTarget: Number(e.target.value) }))}
                    className="w-24 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                </div>
              </div>
            </>
          )}

          {/* Step 1: Audience */}
          {step === 1 && (
            <>
              <h2 className="font-semibold text-gray-200">Select Audience</h2>
              <div className="space-y-2">
                {segments.length === 0 && <p className="text-sm text-gray-500">Loading real audience counts…</p>}
                {segments.map(seg => (
                  <button key={seg.id} onClick={() => setForm(f => ({ ...f, audienceSegmentId: seg.id }))}
                    className={`w-full flex justify-between items-center p-4 rounded-xl border transition-colors ${
                      form.audienceSegmentId === seg.id ? "border-green-500 bg-green-900/30" : "border-gray-700 bg-gray-800 hover:border-gray-600"
                    }`}>
                    <div className="text-left">
                      <div className="font-medium text-sm">{seg.name}</div>
                      <div className="text-xs text-gray-400">{seg.size.toLocaleString()} users</div>
                    </div>
                    {form.audienceSegmentId === seg.id && <span className="text-green-400">✓</span>}
                  </button>
                ))}
              </div>
              {selectedSegment && (
                <div className="bg-green-900/20 border border-green-700 rounded-xl p-3 text-sm text-green-300">
                  Estimated reach: {selectedSegment.size.toLocaleString()} recipients
                </div>
              )}
            </>
          )}

          {/* Step 2: Content */}
          {step === 2 && (
            <>
              <h2 className="font-semibold text-gray-200">Campaign Content</h2>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Subject line / WhatsApp headline"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500" />
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Message body…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 resize-none" rows={5} />
              <button onClick={generateWithAi} disabled={generating || !form.name.trim()}
                className="w-full bg-purple-900/50 hover:bg-purple-900 border border-purple-700 rounded-xl py-2 text-sm text-purple-300 transition-colors disabled:opacity-40">
                {generating ? "Generating…" : "✨ Generate with AI (Ollama)"}
              </button>
              {form.aiGenerated && <p className="text-xs text-purple-400">AI-generated content — review before sending</p>}
              <input value={form.couponCode} onChange={e => setForm(f => ({ ...f, couponCode: e.target.value }))}
                placeholder="Attach coupon code (optional, e.g. YOGA20)"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 text-sm" />
            </>
          )}

          {/* Step 3: Schedule */}
          {step === 3 && (
            <>
              <h2 className="font-semibold text-gray-200">Scheduling</h2>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={form.isImmediate} onChange={e => setForm(f => ({ ...f, isImmediate: e.target.checked }))}
                  className="w-4 h-4 accent-green-500" />
                <span className="text-sm">Send immediately when launched</span>
              </label>
              {!form.isImmediate && (
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Schedule date & time</label>
                  <input type="datetime-local" value={form.scheduledAt}
                    onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
                </div>
              )}
            </>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <>
              <h2 className="font-semibold text-gray-200">Review & Launch</h2>
              <div className="space-y-2 text-sm">
                {[
                  ["Name", form.name],
                  ["Type", form.type.replace("_", " ")],
                  ["Channels", form.channels.join(", ")],
                  ["Audience", selectedSegment?.name ?? "—"],
                  ["Goal", `${form.goalType.replace(/_/g, " ")} — target ${form.goalTarget}`],
                  ["Subject", form.subject || "—"],
                  ["Coupon", form.couponCode || "None"],
                  ["Sends", form.isImmediate ? "Immediately" : form.scheduledAt],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-gray-800 pb-2">
                    <span className="text-gray-400">{k}</span>
                    <span className="text-white capitalize">{v}</span>
                  </div>
                ))}
              </div>
              {form.body.trim() && (form.channels.includes("email") || form.channels.includes("push")) ? (
                <p className="text-xs text-green-400 bg-green-950/40 border border-green-900 rounded-lg p-3">
                  This message will be saved as a real notification template and queued to every real customer with marketing consent on Launch
                  ({form.channels.includes("email") ? "email" : "push"}).
                </p>
              ) : (
                <p className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900 rounded-lg p-3">
                  No content written, or no email/push channel selected -- Launch will only update this campaign&apos;s status, nothing will be sent.
                </p>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
            className="px-5 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm disabled:opacity-30 transition-colors">
            ← Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}
              className="px-5 py-3 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-medium disabled:opacity-30 transition-colors">
              Next →
            </button>
          ) : (
            <button onClick={launchCampaign} disabled={launching}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
              {launching ? "Launching…" : "Launch Campaign 🚀"}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      </div>
    </div>
  );
}
