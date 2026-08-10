"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CHANNELS = ["email", "whatsapp", "sms", "push", "in_app", "social"];
const CHANNEL_ICON: Record<string, string> = { email: "📧", whatsapp: "💬", sms: "📱", push: "🔔", in_app: "🏠", social: "📲" };

const SEGMENTS = [
  { id: "seg_free", name: "Free Plan Users", size: 512 },
  { id: "seg_active", name: "Active Members", size: 284 },
  { id: "seg_churn", name: "At-Risk Churn", size: 97 },
  { id: "seg_annual", name: "High-Value Annual Members", size: 63 },
  { id: "seg_bday", name: "Birthday This Month", size: 41 },
];

const STEPS = ["Details", "Audience", "Content", "Schedule", "Review"];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "one_time",
    channels: [] as string[],
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

  function toggleChannel(ch: string) {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter(c => c !== ch) : [...f.channels, ch],
    }));
  }

  function canProceed(): boolean {
    if (step === 0) return !!form.name.trim() && form.channels.length > 0;
    if (step === 1) return !!form.audienceSegmentId;
    if (step === 2) return !!form.body.trim();
    return true;
  }

  const selectedSegment = SEGMENTS.find(s => s.id === form.audienceSegmentId);

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

              <div>
                <label className="text-sm text-gray-400 block mb-2">Channels</label>
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map(ch => (
                    <button key={ch} onClick={() => toggleChannel(ch)}
                      className={`px-3 py-2 rounded-xl text-sm transition-colors ${
                        form.channels.includes(ch) ? "bg-green-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
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
                {SEGMENTS.map(seg => (
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
              <button onClick={() => setForm(f => ({ ...f, body: "🧘 Ready to take your practice to the next level?\n\nUnlock unlimited classes, AI pose coaching, and personalised flows — all for just $49/month.\n\n🎉 Use code YOGA20 for 20% off your first month.\n\n👉 Join now: sohamyoga.com/membership\n\nNamaste,\nThe SohamYoga Team", aiGenerated: true }))}
                className="w-full bg-purple-900/50 hover:bg-purple-900 border border-purple-700 rounded-xl py-2 text-sm text-purple-300 transition-colors">
                ✨ Generate with AI (Ollama)
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
                  ["Audience", SEGMENTS.find(s => s.id === form.audienceSegmentId)?.name ?? "—"],
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
            <button onClick={() => router.push("/admin/campaigns")}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-semibold transition-colors">
              Launch Campaign 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
