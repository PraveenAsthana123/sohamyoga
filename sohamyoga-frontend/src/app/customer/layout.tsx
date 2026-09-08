'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { customerAuthApi, CustomerUser } from '@/lib/api';

// Nav items whose `disableKey` matches an entry in customer.disabled_features
// (see /api/customer/settings) are hidden -- this is a real, functioning
// opt-out, not just a settings toggle that does nothing.
interface NavItem { href: string; label: string; icon: string; disableKey?: string }
interface NavGroup { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { href: '/customer/dashboard', label: 'Dashboard', icon: '📊' },
      { href: '/customer/features', label: 'All Features', icon: '🧭' },
    ],
  },
  {
    title: 'Book & Practice',
    items: [
      { href: '/customer/bookings', label: 'My Bookings', icon: '📅' },
      { href: '/customer/goals', label: 'My Goals', icon: '🎯' },
      { href: '/customer/plan', label: 'My Plan', icon: '🗂️' },
      { href: '/customer/pose-mastery', label: 'Pose Mastery', icon: '🧘' },
    ],
  },
  {
    title: 'My Journey',
    items: [
      { href: '/customer/journey', label: 'My Journey', icon: '🏅', disableKey: 'journey' },
      { href: '/customer/practice-journal', label: 'Practice Journal', icon: '📔', disableKey: 'practice-journal' },
      { href: '/customer/wellness', label: 'Wellness Score', icon: '💚', disableKey: 'wellness' },
      { href: '/customer/loyalty', label: 'Loyalty', icon: '⭐', disableKey: 'loyalty' },
      { href: '/customer/preferences', label: 'Preferences', icon: '⚙️' },
    ],
  },
  {
    title: 'Community & Content',
    items: [
      { href: '/customer/blog', label: 'Blog & Resources', icon: '📖' },
      { href: '/customer/videos', label: 'My Videos', icon: '🎬' },
      { href: '/customer/chat', label: 'My Chats', icon: '💬' },
      { href: '/customer/inbox', label: 'Inbox', icon: '📥' },
      { href: '/customer/social', label: 'Follow Us', icon: '📣' },
      { href: '/community/polls', label: 'Community Polls', icon: '🗳️', disableKey: 'community' },
      { href: '/customer/referral', label: 'Refer a Friend', icon: '🎁', disableKey: 'referral' },
      { href: '/customer/call-requests', label: 'Call In / Call Out', icon: '📞' },
    ],
  },
  {
    title: 'Billing & Account',
    items: [
      { href: '/customer/subscription', label: 'Subscription', icon: '💳' },
      { href: '/customer/shop', label: 'Shop', icon: '🛍️' },
      { href: '/customer/cart', label: 'My Cart', icon: '🛒' },
      { href: '/customer/orders', label: 'My Orders', icon: '📦' },
      { href: '/customer/invoices', label: 'Billing & Invoices', icon: '🧾' },
      { href: '/customer/support', label: 'Support', icon: '🎧' },
      { href: '/customer/profile', label: 'Profile & Addresses', icon: '👤' },
      { href: '/customer/emergency-contacts', label: 'Emergency Contacts', icon: '🚨' },
      { href: '/customer/settings', label: 'Settings', icon: '🛠️' },
      { href: '/customer/integrations', label: 'Integrations', icon: '🔌' },
    ],
  },
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [disabledFeatures, setDisabledFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const publicPaths = ['/customer/login', '/customer/register', '/customer/onboarding'];

  useEffect(() => {
    if (publicPaths.includes(pathname)) {
      setLoading(false);
      return;
    }
    customerAuthApi
      .me()
      .then(u => {
        setUser(u);
        // New customers get routed through the onboarding wizard exactly
        // once -- confirmed zero implementation existed before this (grep,
        // 2026-09-01). Deliberately chained off a successful auth check,
        // not fired independently/in parallel: an earlier version ran this
        // fetch unconditionally for every visitor, including unauthenticated
        // ones (e.g. CSS-008's anonymous redirect tests) -- for those, this
        // call always 401s and no-ops, but the extra concurrent fetch still
        // shifted the timing of the real (unrelated) auth-redirect race
        // against those tests' assertions, breaking every one of them.
        if (sessionStorage.getItem('onboarding_checked') !== 'true') {
          fetch('/api/customer/onboarding', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
              sessionStorage.setItem('onboarding_checked', 'true');
              if (d && !d.onboarding_completed_at) router.replace('/customer/onboarding');
            })
            .catch(() => {});
        }
      })
      .catch(() => router.push('/customer/login'))
      .finally(() => setLoading(false));
    fetch('/api/customer/settings', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setDisabledFeatures(d?.disabledFeatures ?? []))
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    await customerAuthApi.logout();
    sessionStorage.removeItem('onboarding_checked'); // avoid skipping the check for a different customer on this tab
    router.push('/customer/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (publicPaths.includes(pathname)) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white shadow-sm border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <Link href="/" className="block">
            <span className="text-xl font-bold text-primary-700">SohamYoga</span>
          </Link>
          <p className="text-xs text-gray-500 mt-1">Customer Portal</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-4">
          {NAV_GROUPS.map(group => {
            const visible = group.items.filter(item => !item.disableKey || !disabledFeatures.includes(item.disableKey));
            if (!visible.length) return null;
            return (
              <div key={group.title}>
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">{group.title}</p>
                <div className="space-y-0.5">
                  {visible.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        pathname === item.href
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          {user && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
