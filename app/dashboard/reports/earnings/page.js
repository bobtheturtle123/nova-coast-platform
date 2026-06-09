"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useDashboardPermissions } from "@/lib/dashboardPermissions";

const usd = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

export default function EarningsReportPage() {
  const { permissions, userRole } = useDashboardPermissions();
  const canView = userRole === "owner" || userRole === "admin" || !!permissions?.canViewReports || !!permissions?.canViewRevenue;

  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/dashboard/reports/earnings?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { setError("You don't have permission to view earnings."); return; }
      if (!res.ok) { setError(`Could not load earnings (${res.status}).`); return; }
      setData(await res.json());
    } catch (e) { setError(e?.message || "Could not load earnings."); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { if (canView) load(); }, [canView, load]);

  async function downloadCsv() {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`/api/dashboard/reports/earnings?from=${from}&to=${to}&format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `earnings-${from}_to_${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  if (!canView) return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Earnings</h1>
      <p className="text-sm text-red-600">You don't have permission to view earnings.</p>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-2"><Link href="/dashboard/reports" className="text-xs text-gray-400 hover:text-gray-600">&larr; Reports</Link></div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Earnings &amp; Payroll</h1>
          <p className="text-sm text-gray-500 mt-1">What each team member earned from shoots in a date range.</p>
        </div>
        <button onClick={downloadCsv} disabled={!data || !data.members?.length}
          className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          Export CSV
        </button>
      </div>

      {/* Range controls */}
      <div className="flex items-end gap-3 flex-wrap mb-6">
        <label className="text-xs text-gray-500">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="block mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-gray-500">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="block mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </label>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#3486cf] hover:opacity-90 disabled:opacity-60">
          {loading ? "Loading…" : "Apply"}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <Stat label="Total earnings" value={usd(data.totals.earnings)} />
            <Stat label="Total shoots" value={data.totals.shoots} />
            <Stat label="People paid" value={data.members.length} />
          </div>

          {data.members.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🧾</p>
              <p className="text-sm">No assigned shoots in this range.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-2.5 font-medium">Member</th>
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="px-4 py-2.5 font-medium text-right">Shoots</th>
                    <th className="px-4 py-2.5 font-medium text-right">Earnings</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => (
                    <Fragment key={m.memberId}>
                      <tr className="border-b border-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{m.name}</td>
                        <td className="px-4 py-3 text-gray-500 capitalize">{m.customRoleTitle || m.role}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{m.shoots}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{usd(m.earnings)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setExpanded(expanded === m.memberId ? null : m.memberId)}
                            className="text-xs text-[#3486cf] hover:underline">
                            {expanded === m.memberId ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {expanded === m.memberId && (
                        <tr>
                          <td colSpan={5} className="px-4 py-2 bg-gray-50/60">
                            <div className="space-y-1">
                              {m.lineItems.map((li, i) => (
                                <div key={i} className="flex justify-between text-xs text-gray-600">
                                  <span>{li.date} · {li.address || "—"}</span>
                                  <span className="font-medium">{usd(li.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4">{data.note}</p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
