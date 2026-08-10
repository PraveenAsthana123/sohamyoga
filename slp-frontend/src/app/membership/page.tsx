"use client";
import Link from "next/link";

const BENEFITS = [
  { icon: "🎯", title: "Unlimited Classes", desc: "Access every live and on-demand class across all styles and levels." },
  { icon: "🤖", title: "AI Pose Coach", desc: "Real-time pose analysis and correction feedback after every session." },
  { icon: "✨", title: "Personalised Flows", desc: "AI-generated yoga sequences tailored to your goals and schedule." },
  { icon: "📱", title: "WhatsApp Reminders", desc: "Booking confirmations and class reminders sent directly to you." },
  { icon: "👥", title: "Community Access", desc: "Connect with fellow yogis, join challenges, and share your journey." },
  { icon: "📊", title: "Progress Dashboard", desc: "Track sessions, pose scores, streaks, and wellness milestones." },
];

export default function MembershipPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-purple-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-green-600 to-purple-700 text-white py-20 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Join SohamYoga</h1>
        <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
          Unlimited classes, AI coaching, and a supportive community — all in one platform.
        </p>
        <Link href="/payments"
          className="inline-block bg-white text-green-700 font-bold px-8 py-4 rounded-2xl text-lg hover:bg-green-50 transition-colors shadow-lg">
          View Plans
        </Link>
      </div>

      {/* Benefits */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">Everything You Need</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {BENEFITS.map(b => (
            <div key={b.title} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl mb-3">{b.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{b.title}</h3>
              <p className="text-gray-500 text-sm">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center pb-20 px-6">
        <div className="bg-white rounded-2xl shadow-sm p-10 max-w-lg mx-auto space-y-4">
          <h3 className="text-2xl font-bold text-gray-900">Ready to start?</h3>
          <p className="text-gray-500">Try 7 days free on any paid plan. Cancel anytime.</p>
          <Link href="/payments"
            className="block bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl transition-colors">
            See Pricing
          </Link>
          <Link href="/booking"
            className="block text-gray-500 hover:text-gray-700 text-sm transition-colors">
            Browse free classes first →
          </Link>
        </div>
      </div>
    </div>
  );
}
