"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";

const STATUS_STYLES = {
  pending:      { label: "Pending",      cls: "bg-amber-100 text-amber-700" },
  acknowledged: { label: "Acknowledged", cls: "bg-blue-100 text-blue-700" },
  resolved:     { label: "Resolved",     cls: "bg-emerald-100 text-emerald-700" },
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function RevisionsPage() {
  const [revisions, setRevisions]   = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [filter,    setFilter]      = useState("pending"); // pending | acknowledged | resolved | all
  const [expanded,  setExpanded]    = useState(null);
  const [notes,     setNotes]       = useState({});
  const [saving,    setSaving]      = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }
    const token = await user.getIdToken();
    const res   = await fetch(`/api/dashboard/revisions?status=${filter}`, { headers: { Authorization: `Bearer ${token}` } });
    const data  = await res.json();
    setRevisions(data.revisions || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id, status) {
    setSaving(id);
    const user  = auth.currentUser;
    const token = await user.getIdToken();
    await fetch(`/api/dashboard/revisions/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ status, adminNotes: notes[id] || "" }),
    });
    setSaving(null);
    load();
  }

  const pending = revisions.filter((r) => r.status === "pending").length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-2xl text-gray-900 flex items-center gap-2">
            Revision Requests
            {pending > 0 && (
              <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{pending}</span>
            )}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Agent requests for media edits or re-shoots.</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[["pending","Pending"],["acknowledged","Acknowledged"],["resolved","Resolved"],["all","All"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === val ? "border-[#3486cf] text-[#3486cf]" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
        </div>
      ) : revisions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-3xl mb-3">✅</p>
          <p className="font-medium text-gray-600">No {filter !== "all" ? filter : ""} revision requests</p>
          <p className="text-sm text-gray-400 mt-1">When agents submit revision requests, they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {revisions.map((r) => {
            const st = STATUS_STYLES[r.status] || { label: r.status, cls: "bg-gray-100 text-gray-600" };
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="w-full flex items-start gap-3 p-5 text-left hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      <span className="text-xs text-gray-400">{formatDate(r.requestedAt)}</span>
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{r.agentName || r.agentEmail}</p>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{r.agentEmail}</p>
                    <p className="text-sm text-gray-700 mt-1 line-clamp-2">{r.message}</p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-1 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                    {/* Full message */}
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Message</p>
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{r.message}</p>
                    </div>

                    {/* Booking link */}
                    {r.bookingId && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Booking</p>
                        <a href={`/dashboard/bookings/${r.bookingId}`}
                          className="text-sm text-[#3486cf] hover:underline font-medium">
                          View booking →
                        </a>
                      </div>
                    )}

                    {/* Media items */}
                    {r.mediaItems?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Flagged Media ({r.mediaItems.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {r.mediaItems.map((m, i) => (
                            <a key={i} href={m.url || m} target="_blank" rel="noopener noreferrer"
                              className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-[#3486cf] hover:bg-gray-50 transition-colors">
                              Media {i + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Admin notes */}
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Admin Notes</p>
                      <textarea
                        rows={2}
                        value={notes[r.id] ?? r.adminNotes}
                        onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30 resize-none"
                        placeholder="Internal notes (not visible to agent)…"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {r.status === "pending" && (
                        <button onClick={() => updateStatus(r.id, "acknowledged")} disabled={saving === r.id}
                          className="text-sm font-medium px-4 py-2 rounded-lg border border-[#3486cf] text-[#3486cf] hover:bg-[#EEF5FC] transition-colors disabled:opacity-50">
                          {saving === r.id ? "Saving…" : "Acknowledge"}
                        </button>
                      )}
                      {r.status !== "resolved" && (
                        <button onClick={() => updateStatus(r.id, "resolved")} disabled={saving === r.id}
                          className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                          {saving === r.id ? "Saving…" : "Mark Resolved"}
                        </button>
                      )}
                      {r.status === "resolved" && r.resolvedAt && (
                        <p className="text-xs text-gray-400 self-center">Resolved {formatDate(r.resolvedAt)}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
