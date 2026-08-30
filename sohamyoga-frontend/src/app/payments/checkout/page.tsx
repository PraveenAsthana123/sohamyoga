"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface PlanPrice { amount: number; currency: string; billingCycle: string }
interface Plan { slug: string; name: string; planType: string; description: string; prices: PlanPrice[] }

function CheckoutForm() {
  const params = useSearchParams();
  const planSlug = params.get("plan") || "gold";
  const cycle = params.get("cycle") || "monthly";

  const [plans, setPlans] = useState<Plan[] | null>(null);
  useEffect(() => {
    fetch('/api/plans', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setPlans(d?.plans ?? []));
  }, []);

  if (plans === null) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading plan details…</div>;
  }

  const plan = plans.find(p => p.slug === planSlug) ?? plans[0];
  const price = plan?.prices.find(p => p.billingCycle === cycle) ?? plan?.prices[0];
  const interval = price?.billingCycle === 'annual' ? 'year' : price?.billingCycle === 'monthly' ? 'month' : price?.billingCycle ?? '';

  if (!plan || !price) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6 flex items-start justify-center pt-16">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm p-6 text-center text-gray-500">
          No active membership plans are configured yet.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6 flex items-start justify-center pt-16">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-500 mt-1">Complete your SohamYoga membership</p>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Order Summary</h2>
          <div className="flex justify-between text-gray-600">
            <span>{plan.name}</span>
            <span>${price.amount}/{interval}</span>
          </div>
          <div className="border-t pt-3 flex justify-between font-bold text-gray-900">
            <span>Total today</span>
            <span>${price.amount}</span>
          </div>
        </div>

        {/* Payment form (Stripe Elements placeholder) */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Payment Details</h2>
          <div className="space-y-3">
            <input type="text" placeholder="Card number" disabled
              className="w-full border rounded-xl px-4 py-3 text-gray-400 bg-gray-50 cursor-not-allowed" />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="MM / YY" disabled
                className="border rounded-xl px-4 py-3 text-gray-400 bg-gray-50 cursor-not-allowed" />
              <input type="text" placeholder="CVC" disabled
                className="border rounded-xl px-4 py-3 text-gray-400 bg-gray-50 cursor-not-allowed" />
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
            Stripe integration coming soon. You will be charged ${price.amount} after setup.
          </div>
          <button disabled className="w-full bg-purple-600 text-white py-4 rounded-xl font-semibold opacity-50 cursor-not-allowed">
            Pay ${price.amount} — {plan.name}
          </button>
          <p className="text-center text-xs text-gray-400">Secured by Stripe · Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutForm />
    </Suspense>
  );
}
