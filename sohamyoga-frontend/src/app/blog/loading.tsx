export default function BlogLoading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-b-primary-600" />
      <p className="mt-4 text-gray-500 text-sm font-medium">
        Loading blog posts...
      </p>
    </div>
  );
}
