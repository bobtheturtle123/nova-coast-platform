"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

const STATUS_META = {
  rewarded: { label: "Rewarded",      cls: "bg-green-50 text-green-700 border-green-200" },
  pending:  { label: "Pending payment", cls: "bg-amber-50 text-amber-600 border-amber-200" },
  blocked:  { label: "Blocked",        cls: "bg-red-50 text-red-500 border-red-200" },
};

const BLOCKED_LABELS = {
  self_referral:       "Self-referral",
  same_payment_method: "Same payment method",
  monthly_cap_exceeded: "Monthly cap reached",
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy}
      className={`text-xs px-3 py-1.5 rounded-xl border transition-all font-medium flex-shrink-0 ${
        copied ? "bg-green-50 border-green-200 text-green-700" : "border-gray-200 text-gray-500 hover:border-navy/40 hover:text-navy"
      }`}>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function ShareButton({ referralUrl }) {
  const subject = encodeURIComponent("Try KyoriaOS - real estate photography business software");
  const body    = encodeURIComponent(
    `Hey,\n\nI've been using KyoriaOS to manage my real estate photography bookings and payments. Thought you might find it useful too.\n\nSign up with my link and we both get $20 in account credit:\n${referralUrl}\n\nNo credit card required to start.`
  );
  return (
    <a href={`mailto:?subject=${subject}&body=${body}`}
      className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-navy/40 hover:text-navy transition-all font-medium flex-shrink-0">
      Share via Email
    </a>
  );
}

export default function ReferralsPage() {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [newLabel,    setNewLabel]    = useState("");
  const [addingCode,  setAddingCode]  = useState(false);
  const [codeError,   setCodeError]   = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/dashboard/referrals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const d = await res.json(); setData(d); }
      setLoading(false);
    });
  }, []);

  async function addCode() {
    if (!newLabel.trim()) return;
    setAddingCode(true); setCodeError("");
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch("/api/dashboard/referrals/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label: newLabel.trim() }),
    });
    const body = await res.json();
    if (res.ok) {
      setData((d) => ({ ...d, namedReferralCodes: [...(d.namedReferralCodes || []), body.code] }));
      setNewLabel(""); setShowAddForm(false);
    } else {
      setCodeError(body.error || "Failed to create code.");
    }
    setAddingCode(false);
  }

  async function deleteCode(code) {
    if (!confirm(`Remove the "${code}" referral code?`)) return;
    const token = await auth.currentUser?.getIdToken();
    await fetch(`/api/dashboard/referrals/codes?code=${encodeURIComponent(code)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setData((d) => ({ ...d, namedReferralCodes: (d.namedReferralCodes || []).filter((c) => c.code !== code) }));
  }

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );

  const appUrl         = typeof window !== "undefined" ? window.location.origin : "https://app.kyoriaos.com";
  const referralUrl    = data?.referralCode ? `${appUrl}/ref/${data.referralCode}` : null;
  const creditsDollars = Math.floor((data?.creditsCents || 0) / 100);
  const referrals      = data?.referrals || [];
  const namedCodes     = data?.namedReferralCodes || [];

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="page-title">Refer &amp; Earn</h1>
        <p className="page-subtitle">
          Invite other photographers. When they subscribe, you both get $20 in account credit.
        </p>
      </div>

      {/* Credit summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card p-5">
          <p className="text-xs text-gray-400 uppercase tracking-[0.06em] mb-1">Credits Earned</p>
          <p className="text-2xl font-semibold text-navy">${creditsDollars}</p>
          <p className="text-xs text-gray-400 mt-0.5">applied to billing</p>
        </div>
        <div className="stat-card p-5">
          <p className="text-xs text-gray-400 uppercase tracking-[0.06em] mb-1">Successful</p>
          <p className="text-2xl font-semibold text-navy">{data?.totalRewarded ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">paying referrals</p>
        </div>
        <div className="stat-card p-5">
          <p className="text-xs text-gray-400 uppercase tracking-[0.06em] mb-1">Pending</p>
          <p className="text-2xl font-semibold text-navy">{data?.totalPending ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">awaiting payment</p>
        </div>
      </div>

      {/* Referral link */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-charcoal text-sm mb-1">Your Referral Link</h2>
        <p className="text-xs text-gray-400 mb-4">
          Share this link. Credit is applied automatically when the person subscribes.
        </p>

        {referralUrl ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-mono text-sm text-gray-700 truncate">
                {referralUrl}
              </div>
              <CopyButton text={referralUrl} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <ShareButton referralUrl={referralUrl} />
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Running my real estate photography business on KyoriaOS. Sign up with my link and we both get $20:\n${referralUrl}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-navy/40 hover:text-navy transition-all font-medium">
                Share on X
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}&quote=${encodeURIComponent(`Running my real estate photography business on KyoriaOS - sign up with my link and we both get $20!`)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-navy/40 hover:text-navy transition-all font-medium">
                Share on Facebook
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-navy/40 hover:text-navy transition-all font-medium">
                Share on LinkedIn
              </a>
            </div>
          </>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            Your referral link is being generated. Refresh in a moment.
          </div>
        )}
      </div>

      {/* Tracking codes */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-charcoal text-sm">Tracking Codes</h2>
          {namedCodes.length < 10 && !showAddForm && (
            <button onClick={() => setShowAddForm(true)}
              className="text-xs text-navy hover:underline font-medium">
              + Add code
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Create separate links for different channels — Instagram, events, emails — so you can see which ones convert.
        </p>

        {showAddForm && (
          <div className="flex gap-2 mb-4">
            <input
              autoFocus
              type="text" value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCode()}
              placeholder="e.g. Instagram, NAR Conference 2025…"
              className="input-field flex-1 text-sm" maxLength={48} />
            <button onClick={addCode} disabled={addingCode || !newLabel.trim()}
              className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
              {addingCode ? "…" : "Create"}
            </button>
            <button onClick={() => { setShowAddForm(false); setNewLabel(""); setCodeError(""); }}
              className="btn-outline text-sm px-3 py-2">Cancel</button>
          </div>
        )}
        {codeError && <p className="text-xs text-red-500 mb-3">{codeError}</p>}

        {namedCodes.length === 0 && !showAddForm ? (
          <p className="text-xs text-gray-400 italic">No tracking codes yet. Add one to track different referral sources.</p>
        ) : (
          <div className="space-y-2">
            {/* Default code always shown first */}
            {referralUrl && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-charcoal mb-0.5">Default link</p>
                  <p className="font-mono text-xs text-gray-500 truncate">{referralUrl}</p>
                </div>
                <CopyButton text={referralUrl} />
              </div>
            )}
            {namedCodes.map((c) => {
              const url = `${appUrl}/ref/${c.code}`;
              return (
                <div key={c.code} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-charcoal mb-0.5">{c.label}</p>
                    <p className="font-mono text-xs text-gray-500 truncate">{url}</p>
                  </div>
                  <CopyButton text={url} />
                  <button onClick={() => deleteCode(c.code)}
                    className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 px-1.5">Remove</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-charcoal text-sm mb-4">How it works</h2>
        <div className="space-y-3">
          {[
            { n: "1", title: "Share your link",    desc: "Send it to photographers who might benefit from KyoriaOS." },
            { n: "2", title: "They sign up",        desc: "They register using your link. No credit card required to start." },
            { n: "3", title: "They subscribe",      desc: "When they complete their first paid subscription, the reward triggers." },
            { n: "4", title: "Both get $20 credit", desc: "Credit is applied automatically to the next invoice. No action needed." },
          ].map(({ n, title, desc }) => (
            <div key={n} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {n}
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal">{title}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-1">
          <p>Credits reduce your next invoice automatically. They cannot be withdrawn as cash.</p>
          <p>Maximum $200 in credits per month. Credits do not expire.</p>
        </div>
      </div>

      {/* Referral history */}
      {referrals.length > 0 && (
        <div className="card-section overflow-hidden">
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="font-semibold text-charcoal text-sm">Referral History</h2>
          </div>
          <div>
            {referrals.map((r) => {
              const meta      = STATUS_META[r.status] || STATUS_META.pending;
              const date      = r.rewardedAt || r.signedUpAt;
              const dateLabel = date
                ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : null;
              const blockedLabel = r.blockedReason ? BLOCKED_LABELS[r.blockedReason] : null;

              return (
                <div key={r.id} className="flex items-center justify-between px-6 py-3.5 gap-4 transition-colors"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgb(15 23 42 / 0.022)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-charcoal font-medium truncate">
                      {r.refereeEmail || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.status === "rewarded"
                        ? `Rewarded ${dateLabel}`
                        : r.status === "blocked" && blockedLabel
                        ? `Blocked: ${blockedLabel}`
                        : `Signed up ${dateLabel}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {r.status === "rewarded" && (
                      <span className="text-sm font-semibold text-green-700">+$20</span>
                    )}
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {referrals.length === 0 && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-8 text-center">
          <p className="text-3xl mb-3">🔗</p>
          <p className="text-sm font-medium text-charcoal mb-1">No referrals yet</p>
          <p className="text-xs text-gray-400">Share your link above to start earning credit.</p>
        </div>
      )}
    </div>
  );
}
