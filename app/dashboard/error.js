"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    console.error("[dashboard] unhandled error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#fef2f2" }}>
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-[#0F172A] mb-1">Something went wrong</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-sm">
        {error?.message || "An unexpected error occurred on this page."}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="btn-primary px-5 py-2 text-sm"
        >
          Try again
        </button>
        <Link href="/dashboard" className="btn-outline px-5 py-2 text-sm">
          Go to Overview
        </Link>
      </div>
    </div>
  );
}
