export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
        <p className="text-xl font-semibold text-gray-900 mb-2">Page Not Found</p>
        <p className="text-gray-500 mb-6">The page you are looking for does not exist.</p>
        <a href="/admin" className="inline-block bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">← Back to Admin</a>
      </div>
    </div>
  );
}
