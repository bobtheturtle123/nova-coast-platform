"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

// Public "Review & Sign" page reached from the agreement email link.
// /{slug}/sign/{bookingId}?t={token}
//
// Loads the agreement via the token-gated API, renders it, and captures a
// type-your-name signature. On success the booking is stamped server-side so the
// tenant's listing shows the signed agreement — no login required for the client.

export default function SignAgreementPage() {
  const { slug, bookingId } = useParams();
  const search = useSearchParams();
  const token  = search.get("t");

  const [state, setState]   = useState("loading"); // loading | ready | signed | error | notfound
  const [data, setData]     = useState(null);
  const [name, setName]     = useState("");
  const [agree, setAgree]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]       = useState("");

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
        setName(d.clientName || "");
        setState(d.signed ? "signed" : "ready");
      } catch { if (alive) setState("error"); }
    })();
    return () => { alive = false; };
  }, [slug, bookingId, token]);

  async function submit() {
    setErr("");
    if (!agree)               { setErr("Please check the box to confirm your agreement."); return; }
    if (name.trim().length < 2) { setErr("Please type your full name to sign."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/${slug}/agreement/${bookingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signerName: name.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        setData((p) => ({ ...p, signed: true, signerName: d.signerName || name.trim(), signedAt: d.signedAt || new Date().toISOString() }));
        setState("signed");
      } else {
        setErr(d.error || "Something went wrong. Please try again.");
      }
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const primary = data?.primaryColor || "#3486cf";

  const shell = (children) => (
    <div style={{ minHeight: "100vh", background: "#f4f5f7", padding: "40px 16px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>{children}</div>
    </div>
  );

  if (state === "loading") {
    return shell(<p style={{ textAlign: "center", color: "#888", marginTop: 60 }}>Loading agreement…</p>);
  }

  if (state === "notfound" || state === "error") {
    return shell(
      <div style={{ background: "#fff", borderRadius: 14, padding: "36px 28px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🔗</div>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Link not available</h1>
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
          This signing link is invalid or has expired. Please contact your photographer for a new link.
        </p>
      </div>
    );
  }

  if (state === "signed") {
    const when = data?.signedAt ? new Date(data.signedAt).toLocaleString([], { dateStyle: "long", timeStyle: "short" }) : null;
    return shell(
      <div style={{ background: "#fff", borderRadius: 14, padding: "36px 28px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 14px" }}>✓</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>Agreement signed</h1>
        <p style={{ color: "#555", fontSize: 14, margin: "0 0 4px" }}>
          Thank you{data?.signerName ? `, ${data.signerName}` : ""}. Your agreement has been recorded.
        </p>
        {when && <p style={{ color: "#999", fontSize: 12.5, margin: 0 }}>Signed {when}</p>}
      </div>
    );
  }

  // state === "ready"
  return shell(
    <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid #f0f0f0" }}>
        {data?.businessName && (
          <p style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: 0.3, color: primary, margin: "0 0 6px", textTransform: "uppercase" }}>{data.businessName}</p>
        )}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: "0 0 4px" }}>Service Agreement</h1>
        {data?.address && <p style={{ color: "#777", fontSize: 13.5, margin: 0 }}>{data.address}</p>}
      </div>

      <div style={{ padding: "20px 28px" }}>
        <div style={{ background: "#f9f9f7", border: "1px solid #eee", borderRadius: 10, padding: "18px 20px", whiteSpace: "pre-wrap", fontSize: 13.5, color: "#444", lineHeight: 1.7, maxHeight: 360, overflowY: "auto" }}>
          {data?.agreementText || "No agreement text provided."}
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "20px 0 16px", cursor: "pointer" }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, accentColor: primary }} />
          <span style={{ fontSize: 13.5, color: "#444", lineHeight: 1.5 }}>
            I have read and agree to the terms of this service agreement.
          </span>
        </label>

        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#555", margin: "0 0 6px" }}>Type your full name to sign</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 15, border: "1px solid #d8d8d8", borderRadius: 9, outline: "none", fontFamily: "Georgia, serif" }}
        />

        {err && <p style={{ color: "#dc2626", fontSize: 13, margin: "12px 0 0" }}>{err}</p>}

        <button
          onClick={submit}
          disabled={submitting}
          style={{ width: "100%", marginTop: 18, padding: "14px", fontSize: 15, fontWeight: 700, color: "#fff", background: primary, border: "none", borderRadius: 10, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? "Signing…" : "Sign Agreement"}
        </button>

        <p style={{ color: "#aaa", fontSize: 11.5, textAlign: "center", margin: "12px 0 0" }}>
          By signing, you agree this constitutes your legal electronic signature.
        </p>
      </div>
    </div>
  );
}
