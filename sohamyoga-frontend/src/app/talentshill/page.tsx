'use client';

import Link from 'next/link';
import { useState } from 'react';

const stats = [
  { value: '500+', label: 'Campaigns Run' },
  { value: '98%', label: 'Client Retention' },
  { value: '3.2x', label: 'Average ROAS' },
  { value: '50+', label: 'Team Experts' },
];

const services = [
  {
    icon: '🔍',
    title: 'SEO & Content',
    desc: 'Rank higher with data-driven content strategies and technical SEO that drives organic growth.',
  },
  {
    icon: '💰',
    title: 'Paid Advertising',
    desc: 'Google, Meta, LinkedIn — precision targeting that maximises every dollar of ad spend.',
  },
  {
    icon: '📱',
    title: 'Social Media',
    desc: 'Build an engaged community with consistent, on-brand storytelling across all platforms.',
  },
  {
    icon: '📧',
    title: 'Email Marketing',
    desc: 'Automated sequences and newsletters that nurture leads into loyal, paying customers.',
  },
  {
    icon: '📊',
    title: 'Analytics & BI',
    desc: 'Real-time dashboards and monthly reports that translate data into actionable strategy.',
  },
  {
    icon: '🎨',
    title: 'Brand Strategy',
    desc: 'Positioning, messaging, and visual identity that make your brand impossible to ignore.',
  },
];

const whyCards = [
  {
    icon: '🎯',
    title: 'Measurable Results',
    desc: 'Every campaign is tied to KPIs. No vanity metrics — only revenue-impacting outcomes tracked in your live portal.',
  },
  {
    icon: '🤝',
    title: 'Dedicated Team',
    desc: 'A named account manager + specialist squad assigned to your account from day one.',
  },
  {
    icon: '⚡',
    title: 'Agile Execution',
    desc: 'Weekly sprints, bi-weekly check-ins, and same-day response SLA for all client requests.',
  },
];

export default function TalentsHillLandingPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleGetStarted(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen text-white">
      {/* Public Nav */}
      <nav className="backdrop-blur-xl bg-white/5 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
            TalentsHill
          </span>
          <div className="flex items-center gap-4">
            <a href="#services" className="text-white/60 hover:text-white text-sm transition-colors">
              Services
            </a>
            <a href="#why" className="text-white/60 hover:text-white text-sm transition-colors">
              Why Us
            </a>
            <Link
              href="/talentshill/login"
              className="bg-blue-500/80 hover:bg-blue-400/90 backdrop-blur-sm border border-blue-400/30 text-white rounded-xl px-5 py-2 text-sm transition-all"
            >
              Client Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 backdrop-blur-md bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-2 text-sm text-blue-300 mb-8">
          <span>🚀</span>
          <span>Full-service digital marketing agency</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
          Accelerate Your{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
            Digital Growth
          </span>
        </h1>
        <p className="text-white/60 text-xl md:text-2xl max-w-3xl mx-auto mb-10 leading-relaxed">
          Full-service digital marketing that delivers measurable ROI — from strategy and content
          to paid ads and analytics.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/talentshill/login"
            className="bg-blue-500/80 hover:bg-blue-400/90 backdrop-blur-sm border border-blue-400/30 text-white rounded-xl px-8 py-4 font-semibold text-lg transition-all shadow-lg shadow-blue-500/20"
          >
            Start Free Trial
          </Link>
          <button className="backdrop-blur-md bg-white/10 border border-white/20 text-white rounded-xl px-8 py-4 font-semibold text-lg hover:bg-white/20 transition-all">
            View Demo ▶
          </button>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map(({ value, label }) => (
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

      {/* Services Grid */}
      <section id="services" className="max-w-7xl mx-auto px-6 pb-24">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Everything You Need to{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
            Dominate Online
          </span>
        </h2>
        <p className="text-white/50 text-center mb-12 max-w-2xl mx-auto">
          Six core service pillars, one integrated strategy — no agency-hopping required.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {services.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-6 hover:bg-white/15 transition-all group"
            >
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform inline-block">
                {icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why TalentsHill */}
      <section id="why" className="max-w-7xl mx-auto px-6 pb-24">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Why{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
            TalentsHill?
          </span>
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {whyCards.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-8 text-center"
            >
              <div className="text-4xl mb-4">{icon}</div>
              <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
              Grow?
            </span>
          </h2>
          <p className="text-white/60 mb-8">
            Join 500+ brands growing faster with TalentsHill.
          </p>
          {submitted ? (
            <div className="backdrop-blur-md bg-green-500/20 border border-green-400/30 rounded-xl p-4 text-green-300">
              ✅ Thanks! We'll reach out to {email} within 24 hours.
            </div>
          ) : (
            <form onSubmit={handleGetStarted} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@company.com"
                required
                className="flex-1 bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 backdrop-blur-sm focus:outline-none focus:border-blue-400/60 focus:bg-white/15 transition-all"
              />
              <button
                type="submit"
                className="bg-blue-500/80 hover:bg-blue-400/90 backdrop-blur-sm border border-blue-400/30 text-white rounded-xl px-6 py-3 font-semibold transition-all whitespace-nowrap"
              >
                Get Started
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Page Footer */}
      <footer className="backdrop-blur-xl bg-white/5 border-t border-white/10 py-6 px-6 text-center">
        <p className="text-white/30 text-sm">
          © 2026 TalentsHill. Powered by SohamYoga Platform. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
