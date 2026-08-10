"use client";
import Link from "next/link";

export default function BookingConfirmationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm p-10 max-w-md w-full text-center space-y-6">
        <div className="text-6xl">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900">You&apos;re booked!</h1>
        <p className="text-gray-500">
          Your class has been reserved. Check your email for a calendar invite and joining link.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          A WhatsApp reminder will be sent 1 hour before class.
        </div>
        <div className="flex flex-col gap-3">
          <Link href="/booking" className="block bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-colors">
            Browse More Classes
          </Link>
          <Link href="/student/dashboard" className="block bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-colors">
            View My Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
