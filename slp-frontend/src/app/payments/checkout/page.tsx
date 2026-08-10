"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const PLAN_DETAILS: Record<string, { name: string; price: number; interval: string }> = {
  monthly: { name: "Monthly Membership", price: 49, interval: "month" },
  annual:  { name: "Annual Membership",  price: 399, interval: "year"  },
};

function CheckoutForm() {
  const params = useSearchParams();
  const planId = params.get("plan") || "monthly";
  const plan = PLAN_DETAILS[planId] ?? PLAN_DETAILS.monthly;

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
            <span>${plan.price}/{plan.interval}</span>
          </div>
          <div className="border-t pt-3 flex justify-between font-bold text-gray-900">
            <span>Total today</span>
            <span>${plan.price}</span>
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
            Stripe integration coming soon. You will be charged ${plan.price} after setup.
          </div>
          <button disabled className="w-full bg-purple-600 text-white py-4 rounded-xl font-semibold opacity-50 cursor-not-allowed">
            Pay ${plan.price} — {plan.name}
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
