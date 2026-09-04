"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

// Public deposit pay page reached from the deposit-request email when the studio
// has a service agreement enabled: /{slug}/pay/{bookingId}?t={token}
//
// Shows the deposit amount and a single subtle "I have read and agree to the
// Service Agreement" checkbox (the full text opens in a modal). The client must
// accept before paying — no typed name or separate signature. On "Pay 50%
// Deposit" we record the acceptance against the booking, then forward to the
// Stripe checkout that was already created for this deposit.

export default function DepositPayPage() {
  const { slug, bookingId } = useParams();
  const search = useSearchParams();
  const token  = search.get("t");

  const [state, setState] = useState("loading"); // loading | ready | paid | notfound | error
  const [data, setData]   = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) { setState("notfound"); return; }
      try {
        const res = await fetch(`/api/${slug}/agreement/${bookingId}?t=${encodeURIComponent(token)}`);
        if (!res.ok) { if (alive) setState("notfound"); return; }
        const d = await res.json();
        if (!alive) return;
        setData(d);
        setAccepted(!!d.signed);
        if (d.depositPaid) { setState("paid"); return; }
        // No agreement to accept (or already signed) → straight to Stripe.
        if ((!d.agreementEnabled || d.signed) && d.depositCheckoutUrl) {
          window.location.href = d.depositCheckoutUrl;
          return;
        }
        setState("ready");
      } catch { if (alive) setState("error"); }
    })();
    return () => { alive = false; };
  }, [slug, bookingId, token]);

  async function payNow() {
    setErr("");
    if (data?.agreementEnabled && !data?.signed && !accepted) {
      setErr("Please read and agree to the Service Agreement to continue.");
      return;
    }
    setSubmitting(true);
    try {
      // Record acceptance (idempotent server-side). Skip if already signed.
      if (data?.agreementEnabled && !data?.signed) {
        const res = await fetch(`/api/${slug}/agreement/${bookingId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            accepted: true,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setErr(d.error || "Something went wrong. Please try again.");
          setSubmitting(false);
          return;
        }
      }
      if (data?.depositCheckoutUrl) {
        window.location.href = data.depositCheckoutUrl;
      } else {
        setErr("Payment link is unavailable. Please contact your photographer.");
        setSubmitting(false);
      }
    } catch {
      setErr("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const primary = data?.primaryColor || "#3486cf";
  const money = (n) => `$${Number(n || 0).toLocaleString()}`;

  const shell = (children) => (
    <div style={{ minHeight: "100vh", background: "#f4f5f7", padding: "40px 16px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>{children}</div>
    </div>
  );

  if (state === "loading") {
    return shell(<p style={{ textAlign: "center", color: "#888", marginTop: 60 }}>Loading…</p>);
  }

  if (state === "notfound" || state === "error") {
    return shell(
      <div style={{ background: "#fff", borderRadius: 14, padding: "36px 28px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🔗</div>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Link not available</h1>
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
          This payment link is invalid or has expired. Please contact your photographer for a new link.
        </p>
      </div>
    );
  }

  if (state === "paid") {
    return shell(
      <div style={{ background: "#fff", borderRadius: 14, padding: "36px 28px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 14px" }}>✓</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Deposit already paid</h1>
        <p style={{ color: "#555", fontSize: 14, margin: 0 }}>Thank you — your deposit for this booking has been received.</p>
      </div>
    );
  }

  // state === "ready"
  return shell(
    <>
      {showAgreement && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16 }}
          onClick={() => setShowAgreement(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #eee" }}>
              <p style={{ fontWeight: 700, color: "#0F172A", margin: 0 }}>Service Agreement</p>
              <button type="button" onClick={() => setShowAgreement(false)} aria-label="Close"
                style={{ background: "none", border: "none", fontSize: 22, lineHeight: 1, color: "#999", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 20px", whiteSpace: "pre-wrap", fontSize: 13.5, color: "#444", lineHeight: 1.7 }}>
              {data?.agreementText || "No agreement text provided."}
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => setShowAgreement(false)}
                style={{ padding: "10px 18px", fontSize: 14, fontWeight: 600, color: "#555", background: "#f3f4f6", border: "none", borderRadius: 9, cursor: "pointer" }}>Close</button>
              <button type="button" onClick={() => { setAccepted(true); setErr(""); setShowAgreement(false); }}
                style={{ padding: "10px 18px", fontSize: 14, fontWeight: 700, color: "#fff", background: primary, border: "none", borderRadius: 9, cursor: "pointer" }}>I Agree</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid #f0f0f0" }}>
          {data?.businessName && (
            <p style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: 0.3, color: primary, margin: "0 0 6px", textTransform: "uppercase" }}>{data.businessName}</p>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: "0 0 4px" }}>Pay your deposit</h1>
          {data?.address && <p style={{ color: "#777", fontSize: 13.5, margin: 0 }}>{data.address}</p>}
        </div>

        <div style={{ padding: "20px 28px" }}>
          <div style={{ background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontSize: 13.5, color: "#555" }}>50% deposit due</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#0F172A" }}>{money(data?.depositAmount)}</span>
          </div>

          {data?.agreementEnabled && !data?.signed && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "0 0 16px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => { setAccepted(e.target.checked); if (e.target.checked) setErr(""); }}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: primary }}
              />
              <span style={{ fontSize: 13.5, color: "#444", lineHeight: 1.5 }}>
                I have read and agree to the{" "}
                <button type="button" onClick={() => setShowAgreement(true)}
                  style={{ background: "none", border: "none", padding: 0, color: primary, textDecoration: "underline", cursor: "pointer", fontSize: 13.5 }}>
                  Service Agreement
                </button>.
              </span>
            </label>
          )}

          {err && <p style={{ color: "#dc2626", fontSize: 13, margin: "0 0 12px" }}>{err}</p>}

          <button
            onClick={payNow}
            disabled={submitting || (data?.agreementEnabled && !data?.signed && !accepted)}
            style={{ width: "100%", padding: "14px", fontSize: 15, fontWeight: 700, color: "#fff", background: primary, border: "none", borderRadius: 10, cursor: submitting ? "default" : "pointer", opacity: (submitting || (data?.agreementEnabled && !data?.signed && !accepted)) ? 0.6 : 1 }}
          >
            {submitting ? "Redirecting…" : `Pay 50% Deposit — ${money(data?.depositAmount)}`}
          </button>

          <p style={{ color: "#aaa", fontSize: 11.5, textAlign: "center", margin: "12px 0 0" }}>
            You’ll complete payment securely on the next screen.
          </p>
        </div>
      </div>
    </>
  );
}
