import PageHeader from "@/components/ui/dashboard/PageHeader";

const backups = [
  { fileName: "error-log-2026-02-20.json",    records: 142, size: "1.2 MB", generatedAt: "Feb 20, 2026 03:00 AM" },
  { fileName: "error-log-2026-02-19.json",    records: 98,  size: "840 KB", generatedAt: "Feb 19, 2026 03:00 AM" },
  { fileName: "error-log-2026-02-18.ndjson",  records: 215, size: "2.1 MB", generatedAt: "Feb 18, 2026 03:00 AM" },
  { fileName: "error-log-2026-02-17.json",    records: 67,  size: "520 KB", generatedAt: "Feb 17, 2026 03:00 AM" },
  { fileName: "error-log-2026-02-16.json",    records: 183, size: "1.6 MB", generatedAt: "Feb 16, 2026 03:00 AM" },
];

export default function AdminLogs() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs & Backups"
        description="Manage internal error logs and download backup files."
        action={
          <button className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
            Clear Error Logs
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {["DELETE /admin/internal-error-logs", "GET /admin/log-backups", "GET /admin/log-backups/:fileName"].map((ep) => (
          <span key={ep} className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-mono rounded-md">{ep}</span>
        ))}
      </div>

      {/* Info card */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-red-800">Clearing error logs is irreversible</p>
          <p className="text-xs text-red-600 mt-0.5">A backup file is automatically created before deletion. You can download backups below.</p>
        </div>
      </div>

      {/* Backups table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            Log Backups <span className="text-sm font-normal text-gray-400">({backups.length} files)</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-200">
                <th className="px-5 py-3 font-medium">File Name</th>
                <th className="px-5 py-3 font-medium">Records</th>
                <th className="px-5 py-3 font-medium">Size</th>
                <th className="px-5 py-3 font-medium">Generated</th>
                <th className="px-5 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.fileName} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs text-gray-700">{b.fileName}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{b.records}</td>
                  <td className="px-5 py-3 text-gray-600">{b.size}</td>
                  <td className="px-5 py-3 text-gray-500">{b.generatedAt}</td>
                  <td className="px-5 py-3 text-right">
                    <button className="text-blue-600 hover:text-blue-800 text-xs font-medium">Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

