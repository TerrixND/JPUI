import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-white">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-semibold text-gray-900">Page Not Found</h1>
        <p className="text-sm text-gray-500">
          The page you requested does not exist or may have moved.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
