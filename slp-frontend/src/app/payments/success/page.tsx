import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm p-10 max-w-md w-full text-center space-y-6">
        <div className="text-6xl">✨</div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to SohamYoga!</h1>
        <p className="text-gray-500">
          Your membership is now active. Explore unlimited classes, AI pose coaching, and more.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/booking" className="block bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-colors">
            Book Your First Class
          </Link>
          <Link href="/student/dashboard" className="block bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-colors">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
