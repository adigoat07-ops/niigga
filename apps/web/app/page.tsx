"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

type LabResult = {
  testName: string;
  resultValue: string;
  unit: string;
  referenceRange: string;
  flag: string;
  confidence?: number;
  rawText?: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [reportTitle, setReportTitle] = useState("My lab report");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [results, setResults] = useState<LabResult[]>([]);
  const [extractedText, setExtractedText] = useState("");

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) {
      setFile(null);
      return;
    }

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(selectedFile.type)) {
      setMessage("Only PDF, JPG, and PNG files are supported.");
      setFile(null);
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setMessage("File size must be 15MB or less.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setMessage(null);
    setSavedReportId(null);
    setWarningMessage(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!file) {
      setMessage("Please choose a PDF or image file first.");
      return;
    }

    setIsSubmitting(true);
    setMessage("Uploading, running OCR, and saving to database...");
    setSavedReportId(null);
    setWarningMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("reportTitle", reportTitle);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Upload failed");
      }

      setResults(payload.results || []);
      setExtractedText(payload.extractedText || "");

      if (payload.reportId) {
        setSavedReportId(payload.reportId);
        setMessage("Report uploaded and persisted to PostgreSQL successfully.");
      } else {
        setMessage("Report analyzed successfully.");
        if (payload.warning) {
          setWarningMessage(payload.warning);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong.";
      setMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 px-6 py-8 text-slate-900">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="rounded-3xl bg-slate-900 px-8 py-6 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-semibold">LAB SAATHI</p>
              <h1 className="mt-2 text-3xl font-bold">Your lab report, explained simply</h1>
              <p className="mt-1 text-sm text-slate-300 max-w-xl">
                Upload your medical report for automated OCR extraction, structured metrics, and secure PostgreSQL persistence.
              </p>
            </div>
            <div className="absolute right-0 bottom-0 opacity-10 font-black text-9xl select-none pointer-events-none text-white">
              +
            </div>
          </header>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This app provides educational information only, not medical advice or diagnosis. Always consult a qualified medical professional.
          </div>

          <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="space-y-5">
                <div>
                  <label htmlFor="reportTitle" className="mb-2 block text-sm font-medium text-slate-700">
                    Report title
                  </label>
                  <input
                    id="reportTitle"
                    value={reportTitle}
                    onChange={(event) => setReportTitle(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 outline-none ring-0 transition focus:border-cyan-500 focus:bg-white text-sm"
                    placeholder="Annual blood panel"
                  />
                </div>

                <div>
                  <label htmlFor="reportFile" className="mb-2 block text-sm font-medium text-slate-700">
                    Upload lab report
                  </label>
                  <input
                    id="reportFile"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:cursor-pointer"
                  />
                  <p className="mt-2 text-xs text-slate-500">Supported formats: PDF, JPG, PNG • Max size: 15MB</p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !file}
                  className="w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-300 shadow-sm"
                >
                  {isSubmitting ? "Processing and saving report..." : "Upload and analyze report"}
                </button>

                {savedReportId && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">✓ Saved to Database</p>
                      <p className="text-xs text-emerald-700">Report ID: {savedReportId}</p>
                    </div>
                    <Link
                      href="/history"
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition"
                    >
                      View in History →
                    </Link>
                  </div>
                )}

                {warningMessage && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {warningMessage}
                  </div>
                )}

                {message && !savedReportId && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {message}
                  </div>
                )}
              </div>
            </form>

            <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 flex flex-col">
              <h2 className="text-xl font-semibold text-slate-900">OCR extraction preview</h2>
              <div className="mt-4 flex-1 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 overflow-y-auto max-h-[350px]">
                {extractedText ? (
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6">{extractedText}</pre>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No report text extracted yet. Upload a file on the left to extract.
                  </div>
                )}
              </div>
            </aside>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900">Structured results</h2>
              {results.length > 0 && (
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-3 py-1">
                  {results.length} Tests Parsed
                </span>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              {results.length > 0 ? (
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-medium">Test</th>
                      <th className="px-4 py-3 font-medium">Value</th>
                      <th className="px-4 py-3 font-medium">Range</th>
                      <th className="px-4 py-3 font-medium">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {results.map((result, idx) => (
                      <tr key={`${result.testName}-${idx}`}>
                        <td className="px-4 py-3 font-medium text-slate-800">{result.testName}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {result.resultValue} {result.unit}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{result.referenceRange || "Unclear"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              result.flag === "high"
                                ? "rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700"
                                : result.flag === "low"
                                  ? "rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700"
                                  : result.flag === "unclear"
                                    ? "rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
                                    : "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                            }
                          >
                            {result.flag}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-sm text-slate-400">
                  No structured data extracted yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
