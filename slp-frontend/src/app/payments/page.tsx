"use client";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    interval: "",
    features: ["2 classes/month", "Pose library access", "Community feed"],
    cta: "Get Started",
    highlight: false,
  },
  {
    id: "monthly",
    name: "Monthly",
    price: 49,
    interval: "/mo",
    features: ["Unlimited classes", "AI pose coach", "Progress dashboard", "Teacher feedback", "WhatsApp reminders"],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    id: "annual",
    name: "Annual",
    price: 399,
    interval: "/yr",
    badge: "Save 32%",
    features: ["Everything in Monthly", "1-on-1 sessions (2/mo)", "Custom AI routines", "Priority booking", "Offline video downloads"],
    cta: "Best Value",
    highlight: false,
  },
];

export default function PaymentsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Choose Your Practice</h1>
          <p className="text-gray-600 mt-3 text-lg">Invest in your wellness journey with SohamYoga</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map(plan => (
            <div key={plan.id} className={`bg-white rounded-2xl shadow-sm border p-8 flex flex-col ${
              plan.highlight ? "ring-2 ring-purple-500 shadow-lg scale-105" : ""
            }`}>
              {plan.highlight && (
                <div className="text-center mb-4">
                  <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Most Popular</span>
                </div>
              )}
              {plan.badge && (
                <div className="text-center mb-4">
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">{plan.badge}</span>
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h2>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                <span className="text-gray-500">{plan.interval}</span>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-gray-600 text-sm">
                    <span className="text-green-500 mt-0.5">✓</span> {f}
                  </li>
                ))}
              </ul>
              <a href={plan.price === 0 ? "/auth/register" : `/payments/checkout?plan=${plan.id}`}
                 className={`block text-center py-3 px-6 rounded-xl font-semibold transition-colors ${
                   plan.highlight
                     ? "bg-purple-600 text-white hover:bg-purple-700"
                     : "bg-gray-900 text-white hover:bg-gray-800"
                 }`}>
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Feature comparison */}
        <div className="mt-16 bg-white rounded-2xl p-8 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">All Features</h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div className="font-semibold text-gray-700">Feature</div>
            {PLANS.map(p => <div key={p.id} className="font-semibold text-center text-gray-700">{p.name}</div>)}
            {[
              ["Live classes/month", "2", "Unlimited", "Unlimited"],
              ["AI pose coach", "✗", "✓", "✓"],
              ["1-on-1 sessions", "✗", "✗", "2/month"],
              ["WhatsApp reminders", "✗", "✓", "✓"],
              ["Offline downloads", "✗", "✗", "✓"],
              ["Custom AI routines", "✗", "✗", "✓"],
            ].map(([feat, ...vals]) => (
              <>
                <div key={feat} className="py-2 border-t text-gray-600">{feat}</div>
                {vals.map((v, i) => (
                  <div key={i} className="py-2 border-t text-center text-gray-500">{v}</div>
                ))}
              </>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
