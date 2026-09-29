"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";

interface ExtractedItem {
  id: string;
  testName: string;
  resultValue: string | null;
  unit: string | null;
  referenceRange: string | null;
  flag: string;
  confidence?: number | null;
}

interface SavedReport {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  uploadedFile?: {
    originalName: string;
    sizeBytes: number;
    mimeType: string;
  } | null;
  extractedResults: ExtractedItem[];
}

export default function HistoryPage() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load upload history.");
        return res.json();
      })
      .then((data) => {
        setReports(data.reports || []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error fetching reports.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Your Saved Lab Reports</h1>
              <p className="text-sm text-slate-500">Review your past uploaded records and extracted health metrics</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-500 transition"
            >
              + Upload New Report
            </Link>
          </div>

          {isLoading ? (
            <div className="rounded-3xl bg-white p-12 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full mb-3" />
              <p>Loading your report history from PostgreSQL...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
              <p className="font-semibold">Unable to fetch reports</p>
              <p className="mt-1">{error}</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold text-xl mb-4">
                📄
              </div>
              <h3 className="text-lg font-semibold text-slate-800">No reports saved yet</h3>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                Once you upload and analyze your medical lab reports, your structured records and extracted tests will appear here.
              </p>
              <Link
                href="/"
                className="mt-5 inline-block rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-cyan-500"
              >
                Upload your first report
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reports.map((report) => {
                const highCount = report.extractedResults.filter((r) => r.flag === "high").length;
                const lowCount = report.extractedResults.filter((r) => r.flag === "low").length;
                const normalCount = report.extractedResults.filter((r) => r.flag === "normal").length;

                return (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="cursor-pointer rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:ring-cyan-500 hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-900 truncate">{report.title}</h3>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 uppercase">
                          {report.status}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(report.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>

                      {report.uploadedFile && (
                        <p className="mt-3 text-xs text-slate-600 truncate bg-slate-50 rounded-lg p-2 font-mono">
                          📁 {report.uploadedFile.originalName}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 font-medium">
                          {report.extractedResults.length} Tests
                        </span>
                        {highCount > 0 && (
                          <span className="rounded-md bg-rose-100 px-2 py-1 text-rose-700 font-medium">
                            {highCount} High
                          </span>
                        )}
                        {lowCount > 0 && (
                          <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-700 font-medium">
                            {lowCount} Low
                          </span>
                        )}
                        {normalCount > 0 && (
                          <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-700 font-medium">
                            {normalCount} Normal
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-cyan-600 font-semibold">
                      <span>View details</span>
                      <span>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Report Details Modal */}
          {selectedReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedReport.title}</h2>
                    <p className="text-xs text-slate-500">
                      Report ID: {selectedReport.id} • Saved: {new Date(selectedReport.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                    Extracted Test Results ({selectedReport.extractedResults.length})
                  </h4>

                  {selectedReport.extractedResults.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                        <thead className="bg-slate-50 text-slate-700">
                          <tr>
                            <th className="px-4 py-2.5 font-medium">Test</th>
                            <th className="px-4 py-2.5 font-medium">Value</th>
                            <th className="px-4 py-2.5 font-medium">Range</th>
                            <th className="px-4 py-2.5 font-medium">Flag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {selectedReport.extractedResults.map((r) => (
                            <tr key={r.id}>
                              <td className="px-4 py-2.5 font-medium text-slate-800">{r.testName}</td>
                              <td className="px-4 py-2.5 text-slate-700">
                                {r.resultValue} {r.unit}
                              </td>
                              <td className="px-4 py-2.5 text-slate-700">{r.referenceRange || "Unclear"}</td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={
                                    r.flag === "high"
                                      ? "rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"
                                      : r.flag === "low"
                                      ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                                      : r.flag === "unclear"
                                      ? "rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700"
                                      : "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                                  }
                                >
                                  {r.flag}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No structured test records extracted.</p>
                  )}
                </div>

                <div className="border-t border-slate-200 px-6 py-3.5 bg-slate-50 flex justify-end">
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
