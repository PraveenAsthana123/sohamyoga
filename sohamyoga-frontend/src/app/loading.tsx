export default function RootLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-b-primary-600" />
      <p className="mt-4 text-gray-600 text-sm font-medium">Loading...</p>
    </div>
  );
}
