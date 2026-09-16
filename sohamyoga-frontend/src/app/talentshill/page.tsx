'use client';

import { useState } from 'react';
import Link from 'next/link';

// ── Module data (agency-focused copy) ─────────────────────────────────────────

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
  { icon: '📢', name: 'Social Media Management', desc: 'Manage 50+ client social presences, schedules and analytics from one inbox', status: 'Live', category: 'Content', href: '/talentshill/social' },
  { icon: '💰', name: 'Paid Advertising', desc: 'Run client campaigns across Google, Meta, LinkedIn with white-label ROAS reports', status: 'Live', category: 'Advertising', href: '/talentshill/campaigns' },
  { icon: '📊', name: 'Analytics Dashboard', desc: 'Real-time client KPIs, revenue tracking, and white-label executive reports', status: 'Live', category: 'Analytics', href: '/talentshill/analytics' },
  { icon: '🤖', name: 'AI Content Generator', desc: 'Ollama-powered ad copy and blog content generated per client brand voice', status: 'Live', category: 'AI', href: '/talentshill/content' },
  { icon: '📧', name: 'Email Marketing', desc: 'Agency-managed drip sequences and newsletters across all client accounts', status: 'Live', category: 'Automation', href: '/talentshill/campaigns' },
  { icon: '🎯', name: 'A/B Testing', desc: 'Run simultaneous split tests for multiple clients with statistical significance gating', status: 'Live', category: 'Analytics', href: '/talentshill/analytics' },
  { icon: '🪟', name: 'Pop-up Builder', desc: 'Deploy exit-intent and scroll-triggered CTAs across client landing pages', status: 'Beta', category: 'Content', href: '/talentshill/content' },
  { icon: '🔗', name: 'Affiliate Program', desc: 'White-label affiliate portals with per-client commission rules and payout dashboards', status: 'Live', category: 'Advertising', href: '/talentshill/analytics' },
  { icon: '📍', name: 'Customer Tracking', desc: 'Behavioral analytics and funnel analysis per client with shared agency view', status: 'Live', category: 'Analytics', href: '/talentshill/analytics' },
  { icon: '🧩', name: 'Market Research', desc: 'Agency-delivered competitor intelligence, surveys, and industry reports for clients', status: 'Live', category: 'Research', href: '/talentshill/analytics' },
  { icon: '🏷️', name: 'Customer Segmentation', desc: 'RFM, cohort, and ML-based segment models delivered per client audience', status: 'Live', category: 'Analytics', href: '/talentshill/analytics' },
  { icon: '🔬', name: 'A/B & Multivariate Testing', desc: 'Statistical significance frameworks shared across agency team for client experiments', status: 'Beta', category: 'Analytics', href: '/talentshill/analytics' },
  { icon: '📱', name: 'Video Marketing', desc: 'Manage client YouTube channels, Shorts pipelines, and playlist analytics', status: 'Live', category: 'Content', href: '/talentshill/content' },
  { icon: '🌐', name: 'SEO & Content', desc: 'Content calendars, keyword tracking, and blog management per client brand', status: 'Live', category: 'Content', href: '/talentshill/content' },
  { icon: '📋', name: 'CRM & Contacts', desc: 'Agency-side lead pipeline with role-based access per client team member', status: 'Live', category: 'Automation', href: '/talentshill/leads' },
  { icon: '🤝', name: 'Influencer Management', desc: 'Influencer discovery and campaign ROI tracking for client influencer budgets', status: 'Beta', category: 'Advertising', href: '/talentshill/campaigns' },
  { icon: '📡', name: 'Broadcast & Messaging', desc: 'SMS, WhatsApp, and Telegram campaigns managed across client portfolios', status: 'Live', category: 'Automation', href: '/talentshill/campaigns' },
  { icon: '🗺️', name: 'Customer Journey', desc: 'Client-specific touchpoint mapping with lifecycle stage visualizations', status: 'Live', category: 'Analytics', href: '/talentshill/analytics' },
  { icon: '🏆', name: 'Loyalty Program', desc: 'White-label points, tiers, and rewards gamification deployed per client brand', status: 'Beta', category: 'Automation', href: '/talentshill/analytics' },
  { icon: '🛒', name: 'E-commerce Integration', desc: 'Cart, order, product, and inventory management across client storefronts', status: 'Live', category: 'Automation', href: '/talentshill/analytics' },
  { icon: '🎙️', name: 'Live Chat', desc: 'Real-time support with bot handoff deployed per client website', status: 'Beta', category: 'Automation', href: '/talentshill/analytics' },
  { icon: '📈', name: 'Revenue Attribution', desc: 'Multi-touch attribution and channel ROI for every client campaign dollar', status: 'Live', category: 'Analytics', href: '/talentshill/analytics' },
  { icon: '🔍', name: 'Competitor Intelligence', desc: 'Signal tracking, competitive matrix, and alerts delivered per client vertical', status: 'Live', category: 'Research', href: '/talentshill/analytics' },
  { icon: '🧠', name: 'Vector DB & RAG', desc: 'Client document indexing, semantic search, and AI Q&A over brand assets', status: 'Live', category: 'AI', href: '/talentshill/analytics' },
  { icon: '📁', name: 'Document Management', desc: 'Agency-side contract signing, SOW version control, and compliance tracking', status: 'Beta', category: 'Automation', href: '/talentshill/analytics' },
  { icon: '🏢', name: 'Organization Management', desc: 'Multi-tenant workspaces with role management, billing, and client isolation', status: 'Live', category: 'Automation', href: '/talentshill/settings' },
  { icon: '🗓️', name: 'Calendar & Scheduling', desc: 'Cal.com booking and approval workflows per client and campaign team', status: 'Live', category: 'Automation', href: '/talentshill/analytics' },
  { icon: '🔔', name: 'Notification Center', desc: 'Team collaboration alerts, approval requests, and client-facing status updates', status: 'Live', category: 'Automation', href: '/talentshill/analytics' },
  { icon: '🎭', name: 'Market Research Portal', desc: 'Deep research portal with industry trend analysis and AI-assisted insight delivery', status: 'Live', category: 'Research', href: '/talentshill/analytics' },
  { icon: '🗼', name: 'AI Control Tower', desc: 'Explainable AI, governance audit trail, and security monitoring for agency operations', status: 'Beta', category: 'AI', href: '/talentshill/analytics' },
];

const CATEGORIES: Array<'All' | ModuleCategory> = ['All', 'Content', 'Advertising', 'Analytics', 'Automation', 'AI', 'Research'];

const STATUS_STYLES: Record<ModuleStatus, string> = {
  Live: 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40',
  Beta: 'bg-amber-500/30 text-amber-300 border border-amber-400/40',
  'Coming Soon': 'bg-slate-500/30 text-slate-300 border border-slate-400/40',
};

// ── Onboarding steps (agency) ──────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  { num: 1, icon: '🏢', title: 'Agency Sign Up', desc: 'Create your agency account and set team roles', time: '2 min' },
  { num: 2, icon: '👥', title: 'Add Clients', desc: 'Invite client accounts with isolated workspaces', time: '5 min' },
  { num: 3, icon: '🔗', title: 'Connect Platforms', desc: "Link each client's ad accounts and social profiles", time: '10 min' },
  { num: 4, icon: '🚀', title: 'Build Campaigns', desc: 'Build and schedule campaigns for all clients', time: '30 min' },
  { num: 5, icon: '📡', title: 'Launch & Monitor', desc: 'Launch campaigns and monitor real-time KPIs', time: 'Live' },
  { num: 6, icon: '📋', title: 'Report to Clients', desc: 'Send white-label PDF reports and schedule reviews', time: 'Monthly' },
];

// ── Market Research features ───────────────────────────────────────────────────

const RESEARCH_FEATURES = [
  { icon: '🔍', title: 'Competitor Tracking', desc: 'Signal detection, competitive matrix, and real-time alerts per client vertical' },
  { icon: '📉', title: 'Industry Trend Analysis', desc: 'Cross-industry trend detection with time-series pattern recognition' },
  { icon: '📝', title: 'Survey Creation & AI Analysis', desc: 'Build surveys and auto-analyze responses with sentiment and topic extraction' },
  { icon: '📣', title: 'Share of Voice Monitoring', desc: 'Track brand vs. competitor SOV across channels and media types' },
  { icon: '🏷️', title: 'Customer Segmentation & RFM', desc: 'ML-powered RFM scoring, cohort analysis, and behavioral segments' },
  { icon: '📐', title: 'Advanced Statistical Analysis', desc: 'Time series, correlation, regression, and significance testing built-in' },
  { icon: '🤖', title: 'ML Classification & Anomaly Detection', desc: 'Supervised classification models and unsupervised anomaly flagging' },
  { icon: '🧠', title: 'Vector DB Semantic Search & RAG', desc: 'FAISS-backed semantic retrieval over client documents and research corpus' },
  { icon: '✅', title: 'RAGAS-Evaluated AI Outputs', desc: 'Every AI-generated insight is scored by faithfulness, relevance, and recall' },
];

// ── Pricing tiers (agency) ─────────────────────────────────────────────────────

const PRICING = [
  {
    name: 'Agency Starter',
    price: '$299',
    period: '/mo',
    clients: 'Up to 5 clients',
    highlight: false,
    features: [
      { label: '5 client workspaces', included: true },
      { label: 'All 30 modules', included: true },
      { label: 'Basic white-label reports', included: true },
      { label: '3 team members', included: true },
      { label: 'Email + social management', included: true },
      { label: 'Advanced analytics', included: false },
      { label: 'AI content generator', included: false },
      { label: 'Custom branding', included: false },
      { label: 'API access', included: false },
      { label: 'Dedicated account manager', included: false },
    ],
  },
  {
    name: 'Agency Pro',
    price: '$799',
    period: '/mo',
    clients: 'Up to 25 clients',
    highlight: true,
    features: [
      { label: '25 client workspaces', included: true },
      { label: 'All 30 modules (unlimited)', included: true },
      { label: 'Full white-label reporting', included: true },
      { label: '15 team members', included: true },
      { label: 'All channels + automations', included: true },
      { label: 'Advanced analytics + BI', included: true },
      { label: 'AI content generator (unlimited)', included: true },
      { label: 'Custom agency branding', included: true },
      { label: 'API access', included: false },
      { label: 'Dedicated account manager', included: false },
    ],
  },
  {
    name: 'Agency Enterprise',
    price: 'Custom',
    period: '',
    clients: 'Unlimited clients',
    highlight: false,
    features: [
      { label: 'Unlimited client workspaces', included: true },
      { label: 'All modules + custom builds', included: true },
      { label: 'Custom white-label portal', included: true },
      { label: 'Unlimited team members', included: true },
      { label: 'All channels + custom integrations', included: true },
      { label: 'Real-time BI + data warehouse', included: true },
      { label: 'AI + Vector DB + RAG pipeline', included: true },
      { label: 'Full custom branding', included: true },
      { label: 'Full API + webhooks access', included: true },
      { label: 'Dedicated CSM + SLA guarantee', included: true },
    ],
  },
];

// ── Agency ROI Calculator ──────────────────────────────────────────────────────

function AgencyRoiCalculator() {
  const [numClients, setNumClients] = useState(10);
  const [spendPerClient, setSpendPerClient] = useState(5000);
  const [teamSize, setTeamSize] = useState(5);

  const totalRevManaged = numClients * spendPerClient;
  const timeSavedPerWeek = numClients * 3.5;
  const costPerClient = 799 / numClients;
  const manualHours = numClients * 8 * teamSize;
  const platformRoi = ((totalRevManaged * 0.03 - 799) / 799) * 100;

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-3">
          Agency ROI{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
            Calculator
          </span>
        </h2>
        <p className="text-white/60 text-center mb-12 max-w-xl mx-auto">
          See how much time and revenue the platform saves your agency every month.
        </p>
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Inputs */}
          <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-8 space-y-8">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-white/80 font-medium">Number of Clients</label>
                <span className="text-blue-300 font-bold">{numClients}</span>
              </div>
              <input type="range" min={1} max={100} step={1} value={numClients}
                onChange={e => setNumClients(Number(e.target.value))}
                className="w-full accent-blue-400" />
              <div className="flex justify-between text-white/40 text-xs mt-1"><span>1</span><span>100</span></div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-white/80 font-medium">Avg Monthly Spend per Client</label>
                <span className="text-blue-300 font-bold">${spendPerClient.toLocaleString()}</span>
              </div>
              <input type="range" min={500} max={50000} step={500} value={spendPerClient}
                onChange={e => setSpendPerClient(Number(e.target.value))}
                className="w-full accent-blue-400" />
              <div className="flex justify-between text-white/40 text-xs mt-1"><span>$500</span><span>$50k</span></div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-white/80 font-medium">Current Team Size</label>
                <span className="text-blue-300 font-bold">{teamSize} people</span>
              </div>
              <input type="range" min={1} max={50} step={1} value={teamSize}
                onChange={e => setTeamSize(Number(e.target.value))}
                className="w-full accent-blue-400" />
              <div className="flex justify-between text-white/40 text-xs mt-1"><span>1</span><span>50</span></div>
            </div>
          </div>
          {/* Outputs */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Time Saved / Week', value: `${Math.round(timeSavedPerWeek)}h`, sub: 'Across all clients', color: 'from-blue-400 to-cyan-400' },
              { label: 'Revenue Managed', value: `$${totalRevManaged.toLocaleString()}`, sub: 'Total monthly spend', color: 'from-indigo-400 to-purple-400' },
              { label: 'Cost per Client', value: `$${Math.round(costPerClient)}`, sub: 'Agency Pro plan', color: 'from-teal-400 to-emerald-400' },
              { label: 'Platform ROI', value: `${Math.round(Math.max(0, platformRoi))}%`, sub: 'Est. return on platform fee', color: 'from-amber-400 to-orange-400' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 text-center">
                <div className={`text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r ${color} mb-1`}>{value}</div>
                <div className="text-white font-medium text-sm mb-1">{label}</div>
                <div className="text-white/40 text-xs">{sub}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-center text-white/40 text-sm mt-8">
          Without the platform, your team would spend ~{Math.round(manualHours).toLocaleString()} hours/month on manual tasks across {numClients} clients.
        </p>
      </div>
    </section>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TalentsHillSalesPage() {
  const [activeCategory, setActiveCategory] = useState<'All' | ModuleCategory>('All');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  const filtered = activeCategory === 'All' ? MODULES : MODULES.filter(m => m.category === activeCategory);

  function handleGetStarted(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim()) setEmailSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">

      {/* Nav */}
      <nav className="bg-slate-900/80 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
            TalentsHill
          </span>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-white/60 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-white/60 hover:text-white transition-colors">How It Works</a>
            <a href="#research" className="text-white/60 hover:text-white transition-colors">Research</a>
            <a href="#pricing" className="text-white/60 hover:text-white transition-colors">Pricing</a>
            <a href="#roi" className="text-white/60 hover:text-white transition-colors">ROI Calculator</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/talentshill/login" className="text-white/70 hover:text-white text-sm transition-colors hidden sm:block">
              Client Login
            </Link>
            <Link
              href="/talentshill/login"
              className="bg-blue-500/80 hover:bg-blue-400/90  border border-blue-400/30 text-white rounded-xl px-5 py-2 text-sm font-semibold transition-all"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2  bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-2 text-sm text-blue-300 mb-8">
          <span>🏆</span>
          <span>Agency-Grade Digital Marketing Platform</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
          The Agency-Grade{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
            Digital Marketing
          </span>{' '}
          Platform
        </h1>
        <p className="text-white/60 text-xl md:text-2xl max-w-3xl mx-auto mb-10 leading-relaxed">
          Manage all your clients&apos; campaigns from one intelligent dashboard.
          White-label reporting, team collaboration, and 30 integrated modules — built for agencies.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
          <Link
            href="/talentshill/login"
            className="bg-blue-500/80 hover:bg-blue-400/90  border border-blue-400/30 text-white rounded-xl px-8 py-4 font-semibold text-lg transition-all shadow-lg shadow-blue-500/20"
          >
            Start Free Trial
          </Link>
          <button className="bg-slate-800/70 border border-white/20 text-white rounded-xl px-8 py-4 font-semibold text-lg hover:bg-white/20 transition-all">
            Book a Demo ▶
          </button>
        </div>
        {/* Stats */}
        <div className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-8 max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '500+', label: 'Campaigns Run' },
              { value: '98%', label: 'Client Retention' },
              { value: '3.2x', label: 'Average ROAS' },
              { value: '30', label: 'Integrated Modules' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 mb-1">
                  {value}
                </div>
                <div className="text-white/60 text-sm">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All 30 Modules */}
      <section id="features" className="py-24 relative overflow-hidden">
        <div className="absolute top-1/3 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-3">
            All Digital Marketing{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
              Features
            </span>
          </h2>
          <p className="text-white/60 text-center mb-10 max-w-2xl mx-auto">
            Manage 50+ client campaigns simultaneously. Team collaboration with role-based access.
          </p>
          {/* Category filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  activeCategory === cat
                    ? 'bg-blue-500/60 border-blue-400/60 text-white'
                    : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/15 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Module cards */}
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
                <span className="mt-3 text-blue-300 text-sm font-medium group-hover:text-blue-200 transition-colors">
                  Learn More →
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Agency Onboarding Flow */}
      <section id="how-it-works" className="py-24 bg-white/5 relative overflow-hidden">
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-3">
            How It Works
          </h2>
          <p className="text-white/60 text-center mb-14 max-w-xl mx-auto">
            From Agency Sign-Up to Client Reports in 6 Steps
          </p>
          <div className="flex flex-col md:flex-row items-stretch gap-0 flex-wrap justify-center">
            {ONBOARDING_STEPS.map((step, idx) => (
              <div key={step.num} className="flex flex-col md:flex-row items-center flex-1 min-w-0">
                <div className="bg-slate-800/70 border border-white/20 rounded-2xl p-5 text-center flex-1 w-full min-w-[140px]">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm mx-auto mb-3">
                    {step.num}
                  </div>
                  <div className="text-2xl mb-2">{step.icon}</div>
                  <h3 className="text-white font-bold text-sm mb-1">{step.title}</h3>
                  <p className="text-white/60 text-xs leading-relaxed mb-2">{step.desc}</p>
                  <span className="inline-block bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs px-2 py-0.5 rounded-full">
                    {step.time}
                  </span>
                </div>
                {idx < ONBOARDING_STEPS.length - 1 && (
                  <div className="text-white/40 text-xl font-bold px-2 py-3 md:py-0 rotate-90 md:rotate-0 flex-shrink-0">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agency Flow Diagram */}
      <section className="py-24 relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-3">
            Agency Platform{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
              Architecture
            </span>
          </h2>
          <p className="text-white/60 text-center mb-14 max-w-xl mx-auto">
            Team collaboration and approval workflows built into every module.
          </p>
          <div className="flex flex-col gap-6">
            {/* Row 1 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 flex-wrap">
              {[
                { label: '🏢 Agency Admin', color: 'bg-slate-600/60 border-slate-400/40', isArrow: false },
                { label: '→', color: '', isArrow: true },
                { label: '👥 Client Workspaces', color: 'bg-blue-700/50 border-blue-400/40', isArrow: false },
                { label: '→', color: '', isArrow: true },
                { label: '🚀 Campaigns', color: 'bg-amber-700/50 border-amber-400/40', isArrow: false },
                { label: '→', color: '', isArrow: true },
                { label: '📊 Reports', color: 'bg-blue-700/50 border-blue-400/40', isArrow: false },
              ].map((item, i) =>
                item.isArrow ? (
                  <span key={i} className="text-white/40 text-xl font-bold">{item.label}</span>
                ) : (
                  <div key={i} className={` ${item.color} border rounded-xl px-4 py-3 text-white text-sm font-medium whitespace-nowrap`}>
                    {item.label}
                  </div>
                )
              )}
            </div>
            <div className="text-center text-white/40 text-2xl">↓</div>
            {/* Row 2 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 flex-wrap">
              {[
                { label: '✅ Team Approval', color: 'bg-emerald-700/50 border-emerald-400/40', isArrow: false },
                { label: '→', color: '', isArrow: true },
                { label: '🤖 AI Optimisation', color: 'bg-purple-700/50 border-purple-400/40', isArrow: false },
                { label: '→', color: '', isArrow: true },
                { label: '📈 Revenue Attribution', color: 'bg-blue-700/50 border-blue-400/40', isArrow: false },
                { label: '→', color: '', isArrow: true },
                { label: '📋 White-label PDF', color: 'bg-green-700/50 border-green-400/40', isArrow: false },
              ].map((item, i) =>
                item.isArrow ? (
                  <span key={i} className="text-white/40 text-xl font-bold">{item.label}</span>
                ) : (
                  <div key={i} className={` ${item.color} border rounded-xl px-4 py-3 text-white text-sm font-medium whitespace-nowrap`}>
                    {item.label}
                  </div>
                )
              )}
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-10">
            {[
              { color: 'bg-blue-700/50 border-blue-400/40', label: 'Data & Analytics' },
              { color: 'bg-purple-700/50 border-purple-400/40', label: 'AI Layer' },
              { color: 'bg-amber-700/50 border-amber-400/40', label: 'Campaigns' },
              { color: 'bg-green-700/50 border-green-400/40', label: 'Client Output' },
              { color: 'bg-emerald-700/50 border-emerald-400/40', label: 'Workflow' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border ${color}`} />
                <span className="text-white/60 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep Market Intelligence */}
      <section id="research" className="py-24 bg-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-3">
            Deep Market{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
              Intelligence
            </span>
          </h2>
          <p className="text-white/60 text-center mb-14 max-w-2xl mx-auto">
            Every market research capability your agency needs to deliver insight-driven results for clients.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {RESEARCH_FEATURES.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="bg-slate-800/70 border border-white/20 rounded-2xl p-6 hover:bg-white/15 transition-all group"
              >
                <div className="text-3xl mb-4 group-hover:scale-110 transition-transform inline-block">{icon}</div>
                <h3 className="text-white font-semibold mb-2">{title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agency Pricing */}
      <section id="pricing" className="py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-3">
            Agency{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
              Pricing
            </span>
          </h2>
          <p className="text-white/60 text-center mb-14 max-w-xl mx-auto">
            Per-seat pricing that scales with your agency. All plans include 14-day free trial.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING.map(tier => (
              <div
                key={tier.name}
                className={` border rounded-2xl p-8 flex flex-col ${
                  tier.highlight
                    ? 'bg-blue-500/20 border-blue-400/50 ring-2 ring-blue-400/40 shadow-2xl shadow-blue-500/20 scale-105'
                    : 'bg-white/10 border-white/20'
                }`}
              >
                {tier.highlight && (
                  <div className="text-center mb-4">
                    <span className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <h3 className="text-white font-bold text-xl mb-1">{tier.name}</h3>
                <p className="text-blue-300 text-sm mb-4">{tier.clients}</p>
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
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90'
                    : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                }`}>
                  {tier.price === 'Custom' ? 'Contact Sales' : 'Start Free Trial'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <div id="roi">
        <AgencyRoiCalculator />
      </div>

      {/* CTA Footer */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Scale Your{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
              Agency?
            </span>
          </h2>
          <p className="text-white/60 mb-8">
            Join 500+ agencies growing faster with TalentsHill. Get started in minutes.
          </p>
          {emailSubmitted ? (
            <div className=" bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-4 text-emerald-300">
              Thanks! We&apos;ll reach out to {email} within 24 hours.
            </div>
          ) : (
            <form onSubmit={handleGetStarted} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="agency@company.com"
                required
                className="flex-1 bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3  focus:outline-none focus:border-blue-400/60 focus:bg-white/15 transition-all"
              />
              <button
                type="submit"
                className="bg-blue-500/80 hover:bg-blue-400/90  border border-blue-400/30 text-white rounded-xl px-6 py-3 font-semibold transition-all whitespace-nowrap"
              >
                Get Started
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Page footer */}
      <footer className="bg-slate-900/80 border-t border-white/10 py-6 px-6 text-center">
        <p className="text-white/30 text-sm">
          &copy; 2026 TalentsHill. Powered by SohamYoga Platform. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
