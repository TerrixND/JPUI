import Link from "next/link";

export default function BlockedAccountPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-xs uppercase tracking-wider text-red-600 font-semibold">
          Account Access Blocked
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">
          Your account is currently restricted.
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          Contact a main admin for account recovery or wait until the restriction/ban window ends.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
