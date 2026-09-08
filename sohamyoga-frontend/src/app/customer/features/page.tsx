'use client';
// /customer/features — self-service catalog of every real customer-facing
// feature in the portal, grouped by purpose. Rewritten 2026-08-31: several
// linked routes here were previously convincing-looking mocks (hardcoded
// arrays presented as real data) despite this page's own prior claim that
// "nothing here is a placeholder." That claim was false and has been fixed —
// every mock was either rewired to real data or replaced with an honest
// "not yet available" state; the one item still genuinely unbuilt (AI pose
// analysis) is now labeled as such instead of hidden behind fake output.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { customerAuthApi, CustomerUser } from '@/lib/api';

interface FeatureGroup {
  title: string;
  description: string;
  items: Array<{ label: string; href: string; description: string; notYetAvailable?: boolean }>;
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: 'Book & Practice',
    description: 'Browse and reserve real classes.',
    items: [
      { label: 'Book a Class', href: '/booking', description: 'Reserve a spot in an upcoming session.' },
      { label: 'My Bookings', href: '/customer/bookings', description: 'Your real upcoming and past classes.' },
      { label: 'Membership Plans', href: '/membership', description: 'Compare and choose a membership tier.' },
      { label: 'Manage Subscription', href: '/customer/subscription', description: 'View your plan, pause, or cancel.' },
      { label: 'My Goals', href: '/customer/goals', description: 'Structured practice goals, ranked by priority.' },
      { label: 'My Plan', href: '/customer/plan', description: 'Your teacher-assigned personalized practice plan.' },
      { label: 'Pose Mastery', href: '/customer/pose-mastery', description: 'Real teacher assessments of your pose progression.' },
    ],
  },
  {
    title: 'My Journey',
    description: 'Your streaks, badges, and practice history — all real, all earned from actual attendance.',
    items: [
      { label: 'My Journey', href: '/customer/journey', description: 'Streaks, points, badges, and active challenges.' },
      { label: 'Practice Journal', href: '/customer/practice-journal', description: 'Log how each session felt.' },
      { label: 'Wellness Score', href: '/customer/wellness', description: 'Computed from your real practice journal entries.' },
      { label: 'Loyalty', href: '/customer/loyalty', description: 'Your tier, points, and discount.' },
      { label: 'Preferences', href: '/customer/preferences', description: 'Class styles, times, and notification settings.' },
      { label: 'Settings', href: '/customer/settings', description: 'Turn off features you don\'t want to see.' },
    ],
  },
  {
    title: 'AI Wellness',
    description: 'Ollama-powered personalization, run against your own real practice data.',
    items: [
      { label: 'AI Yoga Coach', href: '/ai/coach', description: 'Personalized class and pose recommendations from AiCoachJob.' },
      { label: 'Pose Analysis', href: '/ai/pose', description: 'Camera preview is live; automated feedback is not built yet.', notYetAvailable: true },
    ],
  },
  {
    title: 'Community & Content',
    description: 'Articles, live chat, and social updates.',
    items: [
      { label: 'Blog', href: '/customer/blog', description: 'Studio articles and announcements.' },
      { label: 'Live Chat', href: '/customer/chat', description: 'Message the studio directly.' },
      { label: 'Inbox', href: '/customer/inbox', description: 'Real notifications about your bookings — not an email inbox.' },
      { label: 'Follow Us', href: '/customer/social', description: 'Where our studio is genuinely live on social platforms.' },
      { label: 'Community Polls', href: '/community/polls', description: 'Vote and see real results.' },
      { label: 'Call In / Call Out', href: '/customer/call-requests', description: "Let us know you'll call in, or request a callback." },
    ],
  },
  {
    title: 'Account',
    description: 'Manage your account, payments, and support.',
    items: [
      { label: 'Account Dashboard', href: '/customer/dashboard', description: 'Your account overview and recent activity.' },
      { label: 'Profile & Addresses', href: '/customer/profile', description: 'Manage your saved addresses.' },
      { label: 'Emergency Contacts', href: '/customer/emergency-contacts', description: 'Who to contact if there\'s an emergency during class.' },
      { label: 'Billing & Invoices', href: '/customer/invoices', description: 'Your billing history.' },
      { label: 'Support', href: '/customer/support', description: 'Open a ticket with our team.' },
      { label: 'Integrations', href: '/customer/integrations', description: 'Real integration status — calendar export works today; email/SMS/wearable sync are honestly not built yet.' },
      { label: 'Payments', href: '/payments', description: 'Your payment history and receipts.' },
      { label: 'Refer a Friend', href: '/customer/referral', description: 'Share your referral link and track rewards.' },
    ],
  },
];

export default function CustomerFeaturesPage() {
  const [user, setUser] = useState<CustomerUser | null>(null);

  useEffect(() => {
    customerAuthApi.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Everything available to you</h1>
        <p className="mt-1 text-sm text-gray-500">
          {user ? `Signed in as ${user.name}. ` : ''}
          Every feature below reads and writes real data. Anything not yet built is labeled "not yet available" rather than hidden or faked.
        </p>
      </div>

      <div className="space-y-6">
        {FEATURE_GROUPS.map(group => (
          <section key={group.title} className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">{group.title}</h2>
            <p className="mt-0.5 text-sm text-gray-500">{group.description}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {group.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg border p-3 text-sm ${item.notYetAvailable ? 'border-amber-200 bg-amber-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/40'}`}
                >
                  <div className="font-medium text-gray-900">{item.label}{item.notYetAvailable ? ' (not yet available)' : ''}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{item.description}</div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
