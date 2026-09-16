'use client';

import { useState } from 'react';

// ── Module data ────────────────────────────────────────────────────────────────

type ModuleStatus = 'Live' | 'Beta' | 'Coming Soon';
type ModuleCategory = 'Content' | 'Advertising' | 'Analytics' | 'Automation' | 'AI' | 'Research';

interface Module {
  icon: string;
  name: string;
  desc: string;
  status: ModuleStatus;
  category: ModuleCategory;
  href: string;
}

const MODULES: Module[] = [
  { icon: '📢', name: 'Social Media Management', desc: 'Schedule, publish, and analyze posts across all platforms', status: 'Live', category: 'Content', href: '/admin/social' },
  { icon: '💰', name: 'Paid Advertising', desc: 'Google, Meta, LinkedIn campaign management with ROAS tracking', status: 'Live', category: 'Advertising', href: '/admin/ads' },
  { icon: '📊', name: 'Analytics Dashboard', desc: 'Real-time KPIs, revenue tracking, customer insights', status: 'Live', category: 'Analytics', href: '/admin/analytics' },
  { icon: '🤖', name: 'AI Content Generator', desc: 'Ollama-powered ad copy, descriptions, and blog content', status: 'Live', category: 'AI', href: '/admin/content' },
  { icon: '📧', name: 'Email Marketing', desc: 'Drip campaigns, automation, inbox management', status: 'Live', category: 'Automation', href: '/admin/campaigns' },
  { icon: '🎯', name: 'A/B Testing', desc: 'Split test landing pages, CTAs, and email subjects', status: 'Live', category: 'Analytics', href: '/admin/analytics' },
  { icon: '🪟', name: 'Pop-up Builder', desc: 'Exit-intent, timer, and scroll-triggered CTAs', status: 'Beta', category: 'Content', href: '/admin/content' },
  { icon: '🔗', name: 'Affiliate Program', desc: 'Referral tracking, commission management, payout dashboard', status: 'Live', category: 'Advertising', href: '/admin/analytics' },
  { icon: '📍', name: 'Customer Tracking', desc: 'Behavioral analytics, funnel analysis, heatmaps', status: 'Live', category: 'Analytics', href: '/admin/analytics' },
  { icon: '🧩', name: 'Market Research', desc: 'Surveys, competitor intelligence, industry reports', status: 'Live', category: 'Research', href: '/admin/analytics' },
  { icon: '🏷️', name: 'Customer Segmentation', desc: 'RFM analysis, cohort analysis, ML-based segments', status: 'Live', category: 'Analytics', href: '/admin/analytics' },
  { icon: '🔬', name: 'A/B & Multivariate Testing', desc: 'Statistical significance, winner declaration', status: 'Beta', category: 'Analytics', href: '/admin/analytics' },
  { icon: '📱', name: 'Video Marketing', desc: 'YouTube management, shorts, playlist analytics', status: 'Live', category: 'Content', href: '/admin/content' },
  { icon: '🌐', name: 'SEO & Content', desc: 'Blog management, keyword tracking, content calendar', status: 'Live', category: 'Content', href: '/admin/content' },
  { icon: '📋', name: 'CRM & Contacts', desc: 'Lead management, pipeline, contact history', status: 'Live', category: 'Automation', href: '/admin/leads' },
  { icon: '🤝', name: 'Influencer Management', desc: 'Influencer discovery, campaign tracking, ROI', status: 'Beta', category: 'Advertising', href: '/admin/campaigns' },
  { icon: '📡', name: 'Broadcast & Messaging', desc: 'SMS, WhatsApp, Telegram campaigns', status: 'Live', category: 'Automation', href: '/admin/campaigns' },
  { icon: '🗺️', name: 'Customer Journey', desc: 'Touchpoint mapping, lifecycle stages, milestones', status: 'Live', category: 'Analytics', href: '/admin/analytics' },
  { icon: '🏆', name: 'Loyalty Program', desc: 'Points, tiers, rewards, gamification', status: 'Beta', category: 'Automation', href: '/admin/analytics' },
  { icon: '🛒', name: 'E-commerce Integration', desc: 'Cart, orders, product catalog, inventory', status: 'Live', category: 'Automation', href: '/admin/analytics' },
  { icon: '🎙️', name: 'Live Chat', desc: 'Real-time support, bot handoff, session history', status: 'Beta', category: 'Automation', href: '/admin/analytics' },
  { icon: '📈', name: 'Revenue Attribution', desc: 'Multi-touch attribution, channel ROI', status: 'Live', category: 'Analytics', href: '/admin/analytics' },
  { icon: '🔍', name: 'Competitor Intelligence', desc: 'Signal tracking, competitive matrix, alerts', status: 'Live', category: 'Research', href: '/admin/analytics' },
  { icon: '🧠', name: 'Vector DB & RAG', desc: 'Document indexing, semantic search, AI-powered Q&A', status: 'Live', category: 'AI', href: '/admin/analytics' },
  { icon: '📁', name: 'Document Management', desc: 'Contract signing, version control, compliance', status: 'Beta', category: 'Automation', href: '/admin/analytics' },
  { icon: '🏢', name: 'Organization Management', desc: 'Multi-tenant, role management, billing', status: 'Live', category: 'Automation', href: '/admin/settings' },
  { icon: '🗓️', name: 'Calendar & Scheduling', desc: 'Cal.com integration, booking management', status: 'Live', category: 'Automation', href: '/admin/analytics' },
  { icon: '🔔', name: 'Notification Center', desc: 'Multi-channel alerts, push, in-app', status: 'Live', category: 'Automation', href: '/admin/analytics' },
  { icon: '🎭', name: 'Market Research Portal', desc: 'Deep research, industry analysis, trend detection', status: 'Live', category: 'Research', href: '/admin/analytics' },
  { icon: '🗼', name: 'AI Control Tower', desc: 'Explainable AI, governance, security monitoring', status: 'Beta', category: 'AI', href: '/admin/analytics' },
];

const CATEGORIES: Array<'All' | ModuleCategory> = ['All', 'Content', 'Advertising', 'Analytics', 'Automation', 'AI', 'Research'];

const STATUS_STYLES: Record<ModuleStatus, string> = {
  Live: 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40',
  Beta: 'bg-amber-500/30 text-amber-300 border border-amber-400/40',
  'Coming Soon': 'bg-slate-500/30 text-slate-300 border border-slate-400/40',
};

// ── Onboarding steps ───────────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  { num: 1, icon: '👤', title: 'Sign Up', desc: 'Create your account & profile', time: '2 min' },
  { num: 2, icon: '🔗', title: 'Connect', desc: 'Link social accounts & ad platforms', time: '5 min' },
  { num: 3, icon: '⚙️', title: 'Configure', desc: 'Set up campaigns, segments & automations', time: '15 min' },
  { num: 4, icon: '🚀', title: 'Launch', desc: 'Run your first campaign & publish content', time: '10 min' },
  { num: 5, icon: '📈', title: 'Grow', desc: 'Track results, optimize ROI, scale what works', time: 'Ongoing' },
];

// ── Pricing tiers ──────────────────────────────────────────────────────────────

const PRICING = [
  {
    name: 'Starter',
    price: '$99',
    period: '/mo',
    highlight: false,
    features: [
      { label: 'Up to 5 social channels', included: true },
      { label: '3 ad platforms', included: true },
      { label: 'Basic analytics dashboard', included: true },
      { label: 'Email marketing (5k contacts)', included: true },
      { label: 'AI content generator', included: true },
      { label: 'A/B testing', included: false },
      { label: 'Affiliate program', included: false },
      { label: 'Customer segmentation', included: false },
      { label: 'Competitor intelligence', included: false },
      { label: 'Dedicated support', included: false },
    ],
  },
  {
    name: 'Professional',
    price: '$299',
    period: '/mo',
    highlight: true,
    features: [
      { label: 'Unlimited social channels', included: true },
      { label: 'All ad platforms', included: true },
      { label: 'Advanced analytics + BI', included: true },
      { label: 'Email marketing (50k contacts)', included: true },
      { label: 'AI content generator (unlimited)', included: true },
      { label: 'A/B & multivariate testing', included: true },
      { label: 'Affiliate program', included: true },
      { label: 'Customer segmentation + RFM', included: true },
      { label: 'Competitor intelligence', included: false },
      { label: 'Priority support', included: false },
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    highlight: false,
    features: [
      { label: 'Unlimited everything', included: true },
      { label: 'All ad platforms + custom', included: true },
      { label: 'Real-time BI + custom reports', included: true },
      { label: 'Unlimited contacts', included: true },
      { label: 'AI + Vector DB + RAG', included: true },
      { label: 'All testing features', included: true },
      { label: 'Full affiliate program', included: true },
      { label: 'ML segmentation + cohorts', included: true },
      { label: 'Full competitor intelligence', included: true },
      { label: 'Dedicated CSM + SLA', included: true },
    ],
  },
];

// ── ROI Calculator ─────────────────────────────────────────────────────────────

function RoiCalculator() {
  const [adSpend, setAdSpend] = useState(10000);
  const [convRate, setConvRate] = useState(3);
  const [aov, setAov] = useState(150);

  const visits = adSpend / 2; // assume $2 CPC
  const currentRevenue = visits * (convRate / 100) * aov;
  const liftedRevenue = visits * ((convRate * 1.2) / 100) * aov;
  const roas = liftedRevenue / adSpend;
  const lift = liftedRevenue - currentRevenue;
  const monthlyRoi = ((liftedRevenue - adSpend - 299) / (adSpend + 299)) * 100;

  return (
    <section className="py-24 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-3">
          ROI <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">Calculator</span>
        </h2>
        <p className="text-white/60 text-center mb-12 max-w-xl mx-auto">
          See your projected returns with a 20% improvement in conversion rate from our platform.
        </p>
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Inputs */}
          <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-8 space-y-8">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-white/80 font-medium">Monthly Ad Spend</label>
                <span className="text-purple-300 font-bold">${adSpend.toLocaleString()}</span>
              </div>
              <input type="range" min={1000} max={100000} step={1000} value={adSpend}
                onChange={e => setAdSpend(Number(e.target.value))}
                className="w-full accent-purple-400" />
              <div className="flex justify-between text-white/40 text-xs mt-1"><span>$1k</span><span>$100k</span></div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-white/80 font-medium">Current Conversion Rate</label>
                <span className="text-purple-300 font-bold">{convRate}%</span>
              </div>
              <input type="range" min={1} max={10} step={0.1} value={convRate}
                onChange={e => setConvRate(Number(e.target.value))}
                className="w-full accent-purple-400" />
              <div className="flex justify-between text-white/40 text-xs mt-1"><span>1%</span><span>10%</span></div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-white/80 font-medium">Average Order Value</label>
                <span className="text-purple-300 font-bold">${aov}</span>
              </div>
              <input type="range" min={50} max={500} step={10} value={aov}
                onChange={e => setAov(Number(e.target.value))}
                className="w-full accent-purple-400" />
              <div className="flex justify-between text-white/40 text-xs mt-1"><span>$50</span><span>$500</span></div>
            </div>
          </div>
          {/* Outputs */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Projected Monthly Revenue', value: `$${Math.round(liftedRevenue).toLocaleString()}`, sub: 'With platform', color: 'from-purple-400 to-pink-400' },
              { label: 'Estimated ROAS', value: `${roas.toFixed(1)}x`, sub: 'Return on ad spend', color: 'from-blue-400 to-cyan-400' },
              { label: 'Revenue Lift', value: `+$${Math.round(lift).toLocaleString()}`, sub: 'vs. current', color: 'from-emerald-400 to-teal-400' },
              { label: 'Monthly ROI', value: `${Math.round(monthlyRoi)}%`, sub: 'After platform fee', color: 'from-amber-400 to-orange-400' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 text-center">
                <div className={`text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r ${color} mb-1`}>{value}</div>
                <div className="text-white font-medium text-sm mb-1">{label}</div>
                <div className="text-white/40 text-xs">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Module grid with filters ───────────────────────────────────────────────────

function ModuleGrid() {
  const [activeCategory, setActiveCategory] = useState<'All' | ModuleCategory>('All');

  const filtered = activeCategory === 'All' ? MODULES : MODULES.filter(m => m.category === activeCategory);

  return (
    <section className="py-24 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 relative overflow-hidden">
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-3">
          Complete Digital Marketing <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">Suite</span>
        </h2>
        <p className="text-white/60 text-center mb-10 max-w-2xl mx-auto">
          Everything your business needs — in one platform. 30 integrated modules, all live.
        </p>
        {/* Category filter tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                activeCategory === cat
                  ? 'bg-purple-500/60 border-purple-400/60 text-white'
                  : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/15 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(mod => (
            <a
              key={mod.name}
              href={mod.href}
              className="bg-slate-800/70 border border-white/20 rounded-2xl p-5 hover:bg-white/15 transition-all group flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl group-hover:scale-110 transition-transform inline-block">{mod.icon}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[mod.status]}`}>
                  {mod.status}
                </span>
              </div>
              <h3 className="text-white font-semibold mb-1">{mod.name}</h3>
              <p className="text-white/60 text-sm leading-relaxed flex-1">{mod.desc}</p>
              <span className="mt-3 text-purple-300 text-sm font-medium group-hover:text-purple-200 transition-colors">
                Learn More →
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Onboarding flow ────────────────────────────────────────────────────────────

function OnboardingFlow() {
  return (
    <section className="py-24 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-3">
          How It Works
        </h2>
        <p className="text-white/60 text-center mb-14 max-w-xl mx-auto">
          From Sign-Up to Revenue in 5 Steps
        </p>
        <div className="flex flex-col md:flex-row items-stretch gap-0">
          {ONBOARDING_STEPS.map((step, idx) => (
            <div key={step.num} className="flex flex-col md:flex-row items-center flex-1">
              {/* Card */}
              <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 text-center flex-1 w-full">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm mx-auto mb-3">
                  {step.num}
                </div>
                <div className="text-3xl mb-3">{step.icon}</div>
                <h3 className="text-white font-bold mb-2">{step.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-3">{step.desc}</p>
                <span className="inline-block bg-purple-500/30 border border-purple-400/30 text-purple-200 text-xs px-3 py-1 rounded-full">
                  {step.time}
                </span>
              </div>
              {/* Arrow — hide after last item */}
              {idx < ONBOARDING_STEPS.length - 1 && (
                <div className="text-white/40 text-2xl font-bold px-3 py-4 md:py-0 rotate-90 md:rotate-0 flex-shrink-0">
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Module flow diagram ────────────────────────────────────────────────────────

const FLOW_NODES: Array<{ label: string; color: string; href: string }> = [
  { label: '👤 Customer', color: 'bg-slate-600/60 border-slate-400/40', href: '/customer' },
  { label: '🏠 Landing Page', color: 'bg-green-700/50 border-green-400/40', href: '/lp' },
  { label: '📋 Lead Capture', color: 'bg-green-700/50 border-green-400/40', href: '/admin/leads' },
  { label: '🗂️ CRM', color: 'bg-blue-700/50 border-blue-400/40', href: '/admin/leads' },
  { label: '📧 Email/Social', color: 'bg-amber-700/50 border-amber-400/40', href: '/admin/social' },
  { label: '🏷️ Segmentation', color: 'bg-blue-700/50 border-blue-400/40', href: '/admin/analytics' },
  { label: '🚀 Campaign', color: 'bg-amber-700/50 border-amber-400/40', href: '/admin/campaigns' },
  { label: '📊 Analytics', color: 'bg-blue-700/50 border-blue-400/40', href: '/admin/analytics' },
  { label: '🧠 AI Insights', color: 'bg-purple-700/50 border-purple-400/40', href: '/admin/analytics' },
  { label: '⚡ Optimization', color: 'bg-purple-700/50 border-purple-400/40', href: '/admin/analytics' },
  { label: '📈 Revenue Attribution', color: 'bg-blue-700/50 border-blue-400/40', href: '/admin/analytics' },
];

function ModuleFlowDiagram() {
  return (
    <section className="py-24 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 relative overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-3">
          Platform <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">Architecture</span>
        </h2>
        <p className="text-white/60 text-center mb-14 max-w-xl mx-auto">
          See how all modules connect — from first visit to revenue attribution.
        </p>
        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {[
            { color: 'bg-blue-700/50 border-blue-400/40', label: 'Data & Analytics' },
            { color: 'bg-purple-700/50 border-purple-400/40', label: 'AI Layer' },
            { color: 'bg-green-700/50 border-green-400/40', label: 'Conversion' },
            { color: 'bg-amber-700/50 border-amber-400/40', label: 'Content & Campaign' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded border ${color}`} />
              <span className="text-white/60 text-sm">{label}</span>
            </div>
          ))}
        </div>
        {/* Row 1: Customer → Landing → Lead Capture → CRM */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 flex-wrap">
            {FLOW_NODES.slice(0, 4).map((node, idx) => (
              <div key={node.label} className="flex items-center gap-2">
                <a href={node.href} className={` ${node.color} border rounded-xl px-4 py-3 text-white text-sm font-medium hover:brightness-110 transition-all whitespace-nowrap`}>
                  {node.label}
                </a>
                {idx < 3 && <span className="text-white/40 text-xl font-bold">→</span>}
              </div>
            ))}
          </div>
          {/* Down arrow */}
          <div className="text-center text-white/40 text-2xl">↓</div>
          {/* Row 2: Email/Social → Segmentation → Campaign → Analytics */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 flex-wrap-reverse">
            {FLOW_NODES.slice(4, 8).map((node, idx) => (
              <div key={node.label} className="flex items-center gap-2">
                {idx < 3 && idx !== 0 && <span className="text-white/40 text-xl font-bold">←</span>}
                <a href={node.href} className={` ${node.color} border rounded-xl px-4 py-3 text-white text-sm font-medium hover:brightness-110 transition-all whitespace-nowrap`}>
                  {node.label}
                </a>
                {idx === 0 && <span className="text-white/40 text-xl font-bold">←</span>}
              </div>
            ))}
          </div>
          {/* Down arrow from Analytics */}
          <div className="text-center text-white/40 text-2xl">↓</div>
          {/* Row 3: AI Insights → Optimization → Revenue Attribution */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 flex-wrap">
            {FLOW_NODES.slice(8).map((node, idx) => (
              <div key={node.label} className="flex items-center gap-2">
                <a href={node.href} className={` ${node.color} border rounded-xl px-4 py-3 text-white text-sm font-medium hover:brightness-110 transition-all whitespace-nowrap`}>
                  {node.label}
                </a>
                {idx < 2 && <span className="text-white/40 text-xl font-bold">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Pricing ────────────────────────────────────────────────────────────────────

function PricingSection() {
  return (
    <section className="py-24 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-3">
          Simple, Transparent <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">Pricing</span>
        </h2>
        <p className="text-white/60 text-center mb-14 max-w-xl mx-auto">
          No hidden fees. Cancel any time. All plans include 14-day free trial.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRICING.map(tier => (
            <div
              key={tier.name}
              className={` border rounded-2xl p-8 flex flex-col ${
                tier.highlight
                  ? 'bg-purple-500/20 border-purple-400/50 ring-2 ring-purple-400/40 shadow-2xl shadow-purple-500/20 scale-105'
                  : 'bg-white/10 border-white/20'
              }`}
            >
              {tier.highlight && (
                <div className="text-center mb-4">
                  <span className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <h3 className="text-white font-bold text-xl mb-2">{tier.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">{tier.price}</span>
                <span className="text-white/60">{tier.period}</span>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {tier.features.map(f => (
                  <li key={f.label} className="flex items-center gap-3">
                    <span className={f.included ? 'text-emerald-400' : 'text-white/30'}>
                      {f.included ? '✓' : '—'}
                    </span>
                    <span className={`text-sm ${f.included ? 'text-white/80' : 'text-white/30'}`}>{f.label}</span>
                  </li>
                ))}
              </ul>
              <button className={`w-full rounded-xl py-3 font-semibold transition-all ${
                tier.highlight
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                  : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
              }`}>
                {tier.price === 'Custom' ? 'Contact Sales' : 'Start Free Trial'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Exported composite component ───────────────────────────────────────────────

export default function DigitalMarketingSections() {
  return (
    <>
      <ModuleGrid />
      <OnboardingFlow />
      <ModuleFlowDiagram />
      <PricingSection />
      <RoiCalculator />
    </>
  );
}
