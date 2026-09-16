'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/talentshill/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/talentshill/campaigns', label: 'Campaigns', icon: '🚀' },
  { href: '/talentshill/analytics', label: 'Analytics', icon: '📈' },
  { href: '/talentshill/social', label: 'Social Media', icon: '📱' },
  { href: '/talentshill/content', label: 'Content', icon: '✍️' },
  { href: '/talentshill/ads', label: 'Paid Ads', icon: '💰' },
  { href: '/talentshill/leads', label: 'Leads', icon: '🎯' },
  { href: '/talentshill/reports', label: 'Reports', icon: '📋' },
  { href: '/talentshill/settings', label: 'Settings', icon: '⚙️' },
];

export default function TalentsHillLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isPublicPage =
    pathname === '/talentshill' ||
    pathname === '/talentshill/login' ||
    pathname?.startsWith('/talentshill/signup');

  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* Top Nav */}
      <nav className="bg-slate-900/80 border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-white/70 hover:text-white transition-colors p-1"
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <Link href="/talentshill" className="flex items-center gap-2">
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                TalentsHill
              </span>
              <span className="text-white/40 text-sm hidden sm:block">Client Portal</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-white/70 hover:text-white transition-colors text-sm">
              🔔
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-sm font-bold">
                C
              </div>
              <span className="text-white/70 text-sm hidden sm:block">Client</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-64 bg-slate-900/80 border-r border-white/10 flex flex-col py-6 shrink-0">
            <nav className="flex flex-col gap-1 px-3">
              {navLinks.map(({ href, label, icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                      active
                        ? 'bg-blue-500/30 text-white border border-blue-400/30'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="text-base">{icon}</span>
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto px-4">
              <div className=" bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-white/40 text-xs">Need help?</p>
                <a
                  href="mailto:support@talentshill.com"
                  className="text-blue-400 text-xs hover:text-cyan-400 transition-colors"
                >
                  support@talentshill.com
                </a>
              </div>
            </div>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900/80 border-t border-white/10 py-3 px-6 text-center">
        <p className="text-white/30 text-xs">
          © 2026 TalentsHill. Powered by SohamYoga Platform.
        </p>
      </footer>
    </div>
  );
}
