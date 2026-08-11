'use client';
// /customer/features — self-service catalog of every real customer-facing
// feature in the portal, grouped by purpose. This is the customer-side
// counterpart to the admin's /admin/module-assurance stakeholder view: same
// idea (a full feature inventory), but written for the person actually using
// the portal rather than the person operating it. Routes listed here are all
// real, currently-deployed pages — nothing here is a mock or a "coming soon"
// placeholder unless explicitly labelled as such.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { customerAuthApi, CustomerUser } from '@/lib/api';

interface FeatureGroup {
  title: string;
  description: string;
  items: Array<{ label: string; href: string; description: string }>;
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: 'Book & Practice',
    description: 'Browse and reserve real classes.',
    items: [
      { label: 'Class Catalog', href: '/catalog', description: 'Browse available classes by teacher, level and style.' },
      { label: 'Book a Class', href: '/booking', description: 'Reserve a spot in an upcoming session.' },
      { label: 'Membership Plans', href: '/membership', description: 'Compare and choose a membership tier.' },
    ],
  },
  {
    title: 'AI Wellness',
    description: 'Ollama-powered personalization, run against your own real practice data.',
    items: [
      { label: 'AI Yoga Coach', href: '/ai/coach', description: 'Personalized class and pose recommendations from AiCoachJob.' },
      { label: 'Pose Analysis', href: '/ai/pose', description: 'AI-assisted pose feedback.' },
      { label: 'Progress Tracking', href: '/ai/progress', description: 'Your practice trends over time.' },
    ],
  },
  {
    title: 'My Journey',
    description: 'Your streaks, badges and practice history.',
    items: [
      { label: 'Dashboard', href: '/student/dashboard', description: 'Overview of your streaks, badges and points.' },
      { label: 'Calendar', href: '/student/calendar', description: 'Your upcoming and past bookings.' },
      { label: 'Challenges', href: '/student/challenges', description: 'Active milestones and community challenges.' },
      { label: 'Practice History', href: '/student/history', description: 'Every logged practice journal entry.' },
      { label: 'Preferences', href: '/student/preferences', description: 'Notification and practice preferences.' },
    ],
  },
  {
    title: 'Community & Content',
    description: 'Articles, live chat and social updates.',
    items: [
      { label: 'Blog', href: '/customer/blog', description: 'Studio articles and announcements.' },
      { label: 'Live Chat', href: '/customer/chat', description: 'Message the studio directly.' },
      { label: 'Social Feed', href: '/customer/social', description: 'Recent posts from the studio’s connected social accounts.' },
      { label: 'Community', href: '/community', description: 'Community highlights and shared achievements.' },
    ],
  },
  {
    title: 'Account',
    description: 'Manage your account and payments.',
    items: [
      { label: 'Account Dashboard', href: '/customer/dashboard', description: 'Your account overview and recent activity.' },
      { label: 'Payments', href: '/payments', description: 'Your payment history and receipts.' },
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
          Every feature below is real and working — nothing here is a placeholder.
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
                  className="rounded-lg border border-gray-200 p-3 text-sm hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <div className="font-medium text-gray-900">{item.label}</div>
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
