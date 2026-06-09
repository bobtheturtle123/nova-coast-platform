"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const usd = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => `${Number(n || 0).toFixed(n >= 10 ? 0 : 1)}%`;

// Recommended-action presentation.
const ACTION = {
  normal:        { label: "This account is healthy.",                 cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  watch:         { label: "Watch this account.",                      cls: "bg-amber-50 text-amber-700 border-amber-200" },
  contact:       { label: "Contact this account about storage.",      cls: "bg-orange-50 text-orange-700 border-orange-200" },
  require_addon: { label: "Require storage add-on.",                  cls: "bg-red-50 text-red-700 border-red-200" },
};
const WARN_BADGE = {
  normal: { label: "Normal", cls: "bg-gray-100 text-gray-500" },
  "80":   { label: "80%",    cls: "bg-amber-100 text-amber-700" },
  "90":   { label: "90%",    cls: "bg-orange-100 text-orange-700" },
  "100":  { label: "100%",   cls: "bg-red-100 text-red-700" },
};

const TYPE_LABELS = {
  photoOriginal: "Photo originals",
  webImage:      "Optimized / web images",
  videoOriginal: "Video originals",
  webVideo:      "1080p web videos",
  floorPlan:     "Floor plans",
  document:      "Documents / files",
  preparedZip:   "Prepared ZIPs",
  other:         "Other / unknown",
};

export default function AdminStoragePage() {
  const [authState, setAuthState] = useState("checking"); // checking | denied | ok
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/storage-report", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { setError("Not authorized."); setData(null); return; }
      if (!res.ok) { setError(`Report failed (${res.status}).`); return; }
      setData(await res.json());
    } catch (e) {
      setError(e?.message || "Could not load the storage report.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Strict superadmin gate — storage data is superadmin-only, even for plain admins.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setAuthState("denied"); return; }
      const tok = await u.getIdTokenResult();
      if (tok.claims.role === "superadmin") { setAuthState("ok"); load(); }
      else setAuthState("denied");
    });
    return unsub;
  }, [load]);

  if (authState === "checking") return <Spinner />;
  if (authState === "denied") return (
    <div className="p-10">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Storage Report</h1>
      <p className="text-sm text-red-600">This page is restricted to superadmins.</p>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Storage &amp; Cost Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            Per-account R2 storage, estimated cost, and cleanup visibility.
          </p>
          {data?.generatedAt && (
            <p className="text-xs text-gray-400 mt-1">Generated {new Date(data.generatedAt).toLocaleString()}</p>
          )}
        </div>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#3486cf] hover:opacity-90 disabled:opacity-60">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {data?.pricing?.egressNote && (
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6">
          {data.pricing.egressNote}{" "}
          <span className="text-gray-400">
            Storage rate: {usd(data.pricing.perGbMonthUsd)}/GB-month · Cap: {data.pricing.capPretty}/account.
          </span>
        </p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>
      )}

      {loading && !data && <Spinner />}

      {!loading && !error && data && data.tenants?.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🗄️</p>
          <p className="text-sm">No tenants with tracked storage yet.</p>
        </div>
      )}

      {data && data.tenants?.length > 0 && (
        <>
          <PlatformTotals p={data.platform} />
          {data.projections && <Projections data={data.projections} />}
          <Retention r={data.retention} prepared={data.preparedZips} />
          <OversizedVideos rows={data.oversizedVideos} />

          <h2 className="text-lg font-bold text-gray-900 mt-10 mb-3">
            Accounts <span className="text-gray-400 font-normal">({data.tenants.length})</span>
          </h2>
          <div className="space-y-4">
            {data.tenants.map((t) => <TenantCard key={t.tenantId} t={t} />)}
          </div>
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-24">
      <div className="w-6 h-6 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  const toneCls = tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-red-600" : "text-gray-900";
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${toneCls}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function PlatformTotals({ p }) {
  return (
    <section className="mb-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total tenants" value={p.totalTenants} />
        <Stat label="Total storage" value={p.totalPretty} />
        <Stat label="Est. monthly cost" value={usd(p.costNow)} sub={`→ ${usd(p.costAfter)} after cleanup`} />
        <Stat label="Eligible for cleanup" value={p.eligibleSaved}
          sub={`${p.eligiblePhotos} photos · ${p.eligibleVideos} videos`} />
        <Stat label="Accounts ≥ 80%" value={p.over80} tone={p.over80 ? "warn" : undefined} />
        <Stat label="Accounts ≥ 90%" value={p.over90} tone={p.over90 ? "warn" : undefined} />
        <Stat label="Accounts at/near 100%" value={p.near100} tone={p.near100 ? "bad" : undefined} />
        <Stat label="May need add-on" value={p.needAddon} tone={p.needAddon ? "bad" : undefined} />
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(TYPE_LABELS).map(([k, label]) => (
          <div key={k} className="bg-white border border-gray-100 rounded-lg px-3 py-2">
            <p className="text-[11px] text-gray-400">{label}</p>
            <p className="text-sm font-semibold text-gray-700">{p.byType?.[k]?.pretty || "0 B"}</p>
          </div>
        ))}
      </div>
      {p.oversizedVideos > 0 && (
        <p className="text-xs text-orange-600 mt-3">
          {p.oversizedVideos} oversized video original{p.oversizedVideos !== 1 ? "s" : ""} preserved (could not be transcoded).
        </p>
      )}
    </section>
  );
}

const VERDICT_CLS = {
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  monitor: "bg-amber-50 text-amber-700 border-amber-200",
  addon:   "bg-red-50 text-red-700 border-red-200",
};

function ScenarioTable({ s, title, note }) {
  const v = VERDICT_CLS[s.verdict] || VERDICT_CLS.healthy;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className={`text-xs font-semibold px-3 py-1 rounded-lg border ${v}`}>{s.verdictLabel}</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{note}</p>
      <p className="text-sm text-gray-700 mb-3">
        About <strong>{s.gbPerSub.toLocaleString()} GB</strong> per subscriber →{" "}
        <strong>{usd(s.costPerSub)}/mo</strong> each ·{" "}
        <strong>{pct(s.ratioPct)}</strong> of revenue ·{" "}
        gross margin after storage <strong>{pct(s.grossMarginPct)}</strong>.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="px-2 py-2 font-medium">Subscribers</th>
              <th className="px-2 py-2 font-medium">Est. MRR</th>
              <th className="px-2 py-2 font-medium">Storage cost</th>
              <th className="px-2 py-2 font-medium">Cost / sub</th>
              <th className="px-2 py-2 font-medium">% of revenue</th>
              <th className="px-2 py-2 font-medium">Gross margin</th>
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.subscribers} className="border-b border-gray-50 last:border-0">
                <td className="px-2 py-2 font-medium text-gray-800">{r.subscribers.toLocaleString()}</td>
                <td className="px-2 py-2 text-gray-700">{usd(r.mrr)}</td>
                <td className="px-2 py-2 text-gray-700">{usd(r.storageCost)}</td>
                <td className="px-2 py-2 text-gray-500">{usd(r.costPerSub)}</td>
                <td className="px-2 py-2 text-gray-500">{pct(r.ratioPct)}</td>
                <td className="px-2 py-2 text-gray-500">{pct(r.grossMarginPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Projections({ data }) {
  const a = data.assumptions;
  const plans = Object.keys(a.planMix);
  // Plain-language highlights at the 100 / 500 marks.
  const at = (s, n) => s.rows.find((r) => r.subscribers === n);
  const t100 = at(data.typical, 100), h100 = at(data.heavy, 100);
  const t500 = at(data.typical, 500), h500 = at(data.heavy, 500);

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Storage Cost Projections</h2>
      <p className="text-sm text-gray-500 mb-4 max-w-3xl">
        Estimated monthly storage cost and MRR as subscribers grow, under typical and heavy usage.
        Storage cost scales per subscriber, so the percentage of revenue stays roughly constant —
        the dollar totals are what grow.
      </p>

      {/* Plain-language highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 space-y-1">
          <p>At <strong>100 typical subscribers</strong>, estimated MRR is about <strong>{usd(t100.mrr)}/month</strong>; storage should cost about <strong>{usd(t100.storageCost)}/month</strong> ({pct(t100.ratioPct)} of revenue).</p>
          <p>At <strong>500 typical subscribers</strong>, MRR ≈ <strong>{usd(t500.mrr)}/month</strong>; storage ≈ <strong>{usd(t500.storageCost)}/month</strong>.</p>
          <p className="text-emerald-700 font-medium">{data.typical.verdictLabel} (margin {pct(data.typical.grossMarginPct)})</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 space-y-1">
          <p>If customers are <strong>heavier than expected</strong>: at <strong>100 heavy subscribers</strong>, storage could cost about <strong>{usd(h100.storageCost)}/month</strong> ({pct(h100.ratioPct)} of revenue).</p>
          <p>At <strong>500 heavy subscribers</strong>, storage could reach <strong>{usd(h500.storageCost)}/month</strong>.</p>
          <p className={`font-medium ${data.heavy.verdict === "addon" ? "text-red-700" : data.heavy.verdict === "monitor" ? "text-amber-700" : "text-emerald-700"}`}>
            {data.heavy.verdictLabel} (margin {pct(data.heavy.grossMarginPct)})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ScenarioTable s={data.typical} title="Typical usage" note={a.typical.note} />
        <ScenarioTable s={data.heavy}   title="Heavy usage"   note={a.heavy.note} />
      </div>

      {/* Assumptions */}
      <details className="mt-4">
        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">Assumptions</summary>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="font-semibold text-gray-700 mb-1">Plan mix &amp; prices</p>
            <ul className="space-y-0.5">
              {plans.map((p) => (
                <li key={p}>
                  {pct(a.planMix[p] * 100)} {p[0].toUpperCase() + p.slice(1)} ·{" "}
                  {a.planPrices[p] != null ? `${usd(a.planPrices[p])}/mo` : "price unavailable"} ·{" "}
                  {a.planCaps[p] ?? "—"} listings/yr
                </li>
              ))}
              <li className="text-gray-500 mt-1">Blended MRR ≈ {usd(a.blendedMrrPerSub)}/subscriber · Storage rate {usd(a.perGbMonthUsd)}/GB-month</li>
            </ul>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="font-semibold text-gray-700 mb-1">Usage assumptions</p>
            <p><strong>Typical:</strong> {a.typical.note} ~{a.typical.perListingGB.original} GB original + {a.typical.perListingGB.web} GB web per listing.</p>
            <p className="mt-1"><strong>Heavy:</strong> {a.heavy.note} ~{a.heavy.perListingGB.original} GB original + {a.heavy.perListingGB.web} GB web per listing.</p>
            <p className="mt-1 text-gray-500">Originals held ~1 year (rolling); web/optimized versions kept long-term (~2 years modeled).</p>
          </div>
        </div>
      </details>
    </section>
  );
}

function Retention({ r, prepared }) {
  const Run = ({ title, run }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">{title}</p>
      {run ? (
        <>
          <p className="text-sm font-semibold text-gray-800">{run.at ? new Date(run.at).toLocaleString() : "—"}</p>
          <p className="text-xs text-gray-500 mt-1">
            {run.removedFiles} removed · {run.eligibleFiles} eligible ({run.eligible}) ·{" "}
            {run.videosSkippedLarge} skipped · {run.errors} failed
          </p>
        </>
      ) : <p className="text-sm text-gray-400">No run recorded.</p>}
    </div>
  );
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-3">Cleanup &amp; retention</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Run title="Last dry run" run={r?.lastDryRun} />
        <Run title="Last execute" run={r?.lastExecute} />
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Prepared ZIPs</p>
          <p className="text-sm font-semibold text-gray-800">{prepared?.storageUsed || "0 B"} · {prepared?.ready || 0} ready</p>
          <p className="text-xs text-gray-500 mt-1">
            {prepared?.expiredEligibleForCleanup || 0} expired to clean · {prepared?.failedJobs?.length || 0} failed jobs
          </p>
        </div>
      </div>
    </section>
  );
}

function OversizedVideos({ rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-2">Oversized videos preserved</h2>
      <p className="text-sm text-gray-600 mb-3 max-w-3xl">
        Large video original preserved. 1080p web version could not be generated in serverless.
        Original will not be removed until a web playback version exists.
      </p>
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="px-3 py-2 font-medium">Listing</th>
              <th className="px-3 py-2 font-medium">File</th>
              <th className="px-3 py-2 font-medium">Size</th>
              <th className="px-3 py-2 font-medium">Delivered</th>
              <th className="px-3 py-2 font-medium">Reason</th>
              <th className="px-3 py-2 font-medium">Web version?</th>
              <th className="px-3 py-2 font-medium">Blocking cleanup?</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-2">
                  <div className="text-gray-800">{v.galleryName}</div>
                  <div className="text-[11px] text-gray-400">{v.tenantName}</div>
                </td>
                <td className="px-3 py-2 text-gray-700">{v.fileName}</td>
                <td className="px-3 py-2 font-medium text-gray-800">{v.size}</td>
                <td className="px-3 py-2 text-gray-500">{v.deliveredAt ? new Date(v.deliveredAt).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-2 text-gray-500">{v.reason}</td>
                <td className="px-3 py-2">
                  {v.hasWebVersion
                    ? <span className="text-emerald-600">Yes</span>
                    : <span className="text-red-600">No</span>}
                </td>
                <td className="px-3 py-2">
                  {v.blockingCleanup
                    ? <span className="text-red-600 font-medium">Yes</span>
                    : <span className="text-gray-400">No</span>}
                </td>
                <td className="px-3 py-2">
                  {v.recommendedAction === "external_processing"
                    ? <span className="text-orange-600">External processing needed</span>
                    : <span className="text-gray-500">Leave preserved</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TenantCard({ t }) {
  const action = ACTION[t.action] || ACTION.normal;
  const warn = WARN_BADGE[t.warnLevel] || WARN_BADGE.normal;
  const barColor = t.warnLevel === "100" ? "bg-red-500" : t.warnLevel === "90" ? "bg-orange-500"
    : t.warnLevel === "80" ? "bg-amber-500" : "bg-[#3486cf]";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{t.name}</h3>
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${warn.cls}`}>{warn.label}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            ID: {t.tenantId} · {t.planName}{" "}
            {t.planPrice != null ? `· ${usd(t.planPrice)}/mo` : "· Plan price unavailable"}
          </p>
        </div>
        <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${action.cls}`}>{action.label}</div>
      </div>

      {/* Usage bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>{t.used} used of 10 TB</span>
          <span>{pct(t.pct)}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, t.pct)}%` }} />
        </div>
      </div>

      {/* Plain-language cost summary */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-gray-800 font-medium">{usd(t.costNow)}/mo in storage</p>
          <p className="text-xs text-gray-500">
            {t.costRatioPct != null ? `${pct(t.costRatioPct)} of their ${usd(t.planPrice)}/mo plan` : "Plan price unavailable"}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-gray-800 font-medium">{t.eligibleSaved} eligible to clean</p>
          <p className="text-xs text-gray-500">{t.eligiblePhotos} photos · {t.eligibleVideos} videos</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-gray-800 font-medium">
            {t.eligibleBytes > 0 ? `${usd(t.costAfter)}/mo after cleanup` : "No cleanup savings yet"}
          </p>
          {t.eligibleBytes > 0 && (
            <p className="text-xs text-emerald-600">Saves {usd(Math.max(0, t.costNow - t.costAfter))}/mo</p>
          )}
        </div>
      </div>

      {t.oversizedBytes > 0 && (
        <p className="text-xs text-orange-600 mt-3">
          {t.oversized} of oversized video originals preserved (not yet transcoded).
        </p>
      )}

      {/* Type breakdown */}
      <details className="mt-3">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Storage breakdown by type</summary>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(TYPE_LABELS).map(([k, label]) => (
            <div key={k} className="text-xs">
              <span className="text-gray-400">{label}: </span>
              <span className="text-gray-700 font-medium">{t.byType?.[k]?.pretty || "0 B"}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
