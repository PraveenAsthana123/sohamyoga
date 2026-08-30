"use client";
import { useEffect, useState } from "react";

interface PlanPrice { amount: number; currency: string; billingCycle: string }
interface Plan { slug: string; name: string; planType: string; description: string; prices: PlanPrice[] }

function monthlyPrice(plan: Plan): PlanPrice | undefined {
  return plan.prices.find(p => p.billingCycle === 'monthly') ?? plan.prices[0];
}

export default function PaymentsPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  useEffect(() => {
    fetch('/api/plans', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setPlans(d?.plans ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Choose Your Practice</h1>
          <p className="text-gray-600 mt-3 text-lg">Invest in your wellness journey with SohamYoga</p>
        </div>

        {plans === null ? (
          <p className="text-center text-gray-400 text-sm">Loading plans…</p>
        ) : plans.length === 0 ? (
          <p className="text-center text-gray-500">No active membership plans are configured yet.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, i) => {
              const price = monthlyPrice(plan);
              const highlight = plan.planType === 'gold';
              return (
                <div key={plan.slug} className={`bg-white rounded-2xl shadow-sm border p-8 flex flex-col ${
                  highlight ? "ring-2 ring-purple-500 shadow-lg scale-105" : ""
                }`}>
                  {highlight && (
                    <div className="text-center mb-4">
                      <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Most Popular</span>
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h2>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">${price?.amount ?? '—'}</span>
                    {price && <span className="text-gray-500">/{price.billingCycle === 'annual' ? 'yr' : 'mo'}</span>}
                  </div>
                  {plan.description && <p className="text-gray-600 text-sm mb-8 flex-1">{plan.description}</p>}
                  <a href={`/payments/checkout?plan=${plan.slug}&cycle=${price?.billingCycle ?? 'monthly'}`}
                     className={`block text-center py-3 px-6 rounded-xl font-semibold transition-colors ${
                       highlight
                         ? "bg-purple-600 text-white hover:bg-purple-700"
                         : "bg-gray-900 text-white hover:bg-gray-800"
                     }`}>
                    {i === 0 ? "Get Started" : "Choose Plan"}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
