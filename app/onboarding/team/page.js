"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useOnboarding, StepCard } from "../ctx";
import { avatarColor, initials } from "@/lib/avatar";
import { getEffectivePlan, getSeatLimit } from "@/lib/plans";

const ROLES = ["photographer", "editor", "coordinator", "admin"];

function emptyRow() {
  return { id: Date.now() + Math.random(), name: "", email: "", role: "photographer" };
}

export default function TeamStep() {
  const router = useRouter();
  const { tenant, setTenant, onboarding, saveOnboarding } = useOnboarding();

  // Re-fetch tenant on mount so we always have the latest subscription plan.
  // The onboarding layout loads tenant once; if the Stripe webhook fires after
  // that initial load, the plan change won't be reflected without this refresh.
  useEffect(() => {
    async function refresh() {
      try {
        const token = await auth.currentUser?.getIdToken(true);
        if (!token) return;
        const res = await fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); if (d.tenant) setTenant(d.tenant); }
      } catch {}
    }
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const effectivePlan = getEffectivePlan(tenant);
  const seatLimit = getSeatLimit(effectivePlan, tenant?.addonSeats || 0);
  // Only block team invites when the tenant is provably on a solo-tier active subscription.
  // Trial users and free-trial tenants without a subscription yet should be able to invite.
  const isActiveSolo = seatLimit !== null && seatLimit <= 1 &&
    (tenant?.subscriptionStatus === "active" || tenant?.subscriptionStatus === "past_due");
  const isSolo = isActiveSolo;

  const [rows,   setRows]   = useState([emptyRow()]);
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]  = useState("");
  const [fallbackLinks, setFallbackLinks] = useState([]); // [{email, url}] when email delivery failed
  const [upgrading, setUpgrading] = useState(false);

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      if (tenant?.stripeSubscriptionId) {
        const res  = await fetch("/api/billing/portal", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.url) { window.location.href = data.url; return; }
      }
      const res  = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: "studio" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setUpgrading(false);
  }

  const filledRows = rows.filter(r => r.name.trim() && r.email.trim());

  function addRow() {
    setRows(prev => [emptyRow(), ...prev]);
  }

  function removeRow(id) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function updateRow(id, field, value) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  async function handleSend() {
    if (!filledRows.length) { handleSkip(); return; }
    setSending(true); setError(""); setFallbackLinks([]);
    try {
      const token = await auth.currentUser.getIdToken();
      const failed   = [];   // hard failures (API error)
      const emailNot = [];   // invite created but email not delivered
      for (const row of filledRows) {
        try {
          const res  = await fetch("/api/dashboard/team/invite", {
            method:  "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body:    JSON.stringify({ email: row.email.trim(), role: row.role }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            failed.push({ email: row.email.trim(), reason: data.error || `Error ${res.status}` });
          } else if (data.emailFailed && data.inviteUrl) {
            // Invite record was created but the email didn't go out — give the
            // owner the link so they can share it directly.
            emailNot.push({ email: row.email.trim(), url: data.inviteUrl });
          }
        } catch {
          failed.push({ email: row.email.trim(), reason: "Network error" });
        }
      }

      // Persist only the invites that were actually created (not hard-failed).
      const created = filledRows.filter(r => !failed.some(f => f.email === r.email.trim()));
      await saveOnboarding({
        completed: { ...(onboarding?.completed || {}), team: true },
        teamInvites: created.map(r => ({ name: r.name, email: r.email, role: r.role })),
        currentStep: 4,
      });

      if (failed.length > 0) {
        setError(`Couldn't send ${failed.length} invite${failed.length > 1 ? "s" : ""}: ${failed.map(f => `${f.email} (${f.reason})`).join(", ")}. You can retry from Team & Schedule.`);
        setSending(false);
        return;
      }
      if (emailNot.length > 0) {
        // Created but email didn't deliver — surface the links instead of pretending it sent.
        setFallbackLinks(emailNot);
        setSending(false);
        return;
      }
      setSent(true);
      setTimeout(() => router.push("/onboarding/service-area"), 800);
    } catch { setError("Some invites failed. You can retry from Team & Schedule."); setSending(false); }
  }

  async function handleSkip() {
    await saveOnboarding({
      completed: { ...(onboarding?.completed || {}), team: true },
      skipped:   { ...(onboarding?.skipped   || {}), team: true },
      currentStep: 4,
    });
    router.push("/onboarding/service-area");
  }

  const ctaLabel = sent
    ? "Invites sent ✓"
    : sending
    ? "Sending…"
    : filledRows.length > 0
    ? `Send ${filledRows.length} invite${filledRows.length > 1 ? "s" : ""} & continue`
    : "Continue → Service Area";

  return (
    <StepCard
      eyebrow="Step 3 of 5 · Team"
      headline="Who's shooting with you?"
      lede={isSolo
        ? "The Solo plan is designed for individual photographers. Upgrade to Studio or higher to add team members."
        : "Invite photographers, editors, or coordinators. They'll get their own login and only see what they need."}
      footer={
        <>
          <button className="btn-ghost" onClick={() => router.push("/onboarding/stripe")}>← Back</button>
          {isSolo ? (
            <button className="btn-primary" onClick={handleSkip}>Continue → Service Area</button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="btn-ghost" onClick={handleSkip}>Skip — I&apos;m solo</button>
              <button
                className="btn-primary"
                onClick={handleSend}
                disabled={sending || sent}>
                {ctaLabel}
              </button>
            </div>
          )}
        </>
      }
    >
      {isSolo ? (
        <div style={{ padding: "32px 24px", background: "#F8F7F4", border: "1px solid #E9ECF0", borderRadius: 14, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
          <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Team invites require Studio plan or above</p>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>
            The Solo plan is designed for individual photographers. Upgrade to Studio to invite photographers, assistants, and managers.
          </p>
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            style={{ display: "inline-block", fontSize: 13, fontWeight: 600, color: "#3486cf", padding: "8px 20px", border: "1px solid #3486cf", borderRadius: 8, background: "none", cursor: upgrading ? "not-allowed" : "pointer", opacity: upgrading ? 0.6 : 1 }}>
            {upgrading ? "Opening…" : "Upgrade plan →"}
          </button>
        </div>
      ) : (
        <>
          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 9, fontSize: 13, color: "#DC2626" }}>
              {error}
            </div>
          )}

          {fallbackLinks.length > 0 && (
            <div style={{ marginBottom: 16, padding: "12px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9 }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#92400E" }}>
                Invites created, but the email didn&apos;t send. Share these links directly:
              </p>
              {fallbackLinks.map((f) => (
                <div key={f.email} style={{ marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{f.email}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input readOnly value={f.url} onClick={(e) => e.target.select()}
                      style={{ flex: 1, fontSize: 11, padding: "5px 8px", border: "1px solid #E5E7EB", borderRadius: 6, color: "#3486cf", background: "#fff" }} />
                    <button type="button" onClick={() => navigator.clipboard.writeText(f.url)}
                      style={{ fontSize: 11, fontWeight: 600, color: "#3486cf", background: "none", border: "1px solid #DAE6F4", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>
                      Copy
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => router.push("/onboarding/service-area")}
                style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: "#92400E", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Continue →
              </button>
            </div>
          )}

          {/* Add row button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0F172A" }}>Invite rows</p>
            <button type="button" onClick={addRow}
              style={{ fontSize: 13, color: "#3486cf", fontWeight: 600, background: "none", border: "1px solid #3486cf", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>
              + Add another
            </button>
          </div>

          {/* Invite rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map(row => {
              const filled = row.name.trim() && row.email.trim();
              const av     = avatarColor(row.name || row.email || "?");
              const ini    = initials(row.name || "?");
              return (
                <div key={row.id} style={{
                  display: "grid", gridTemplateColumns: "200px 1fr 150px 32px",
                  gap: 8, alignItems: "center",
                  padding: "10px 14px",
                  border: `1px ${filled ? "solid" : "dashed"} #E9ECF0`,
                  borderRadius: 10,
                  background: filled ? "#FBFAF8" : "transparent",
                  transition: "all 0.12s",
                }}>
                  {/* Name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: filled ? av : "transparent", border: filled ? "none" : "1.5px dashed #D1D5DB", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {filled ? ini : ""}
                    </div>
                    <input type="text" value={row.name} onChange={e => updateRow(row.id, "name", e.target.value)}
                      placeholder="Full name"
                      style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#0F172A", fontFamily: "inherit" }} />
                  </div>

                  {/* Email */}
                  <input type="email" value={row.email} onChange={e => updateRow(row.id, "email", e.target.value)}
                    placeholder="email@company.com"
                    style={{ border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#0F172A", fontFamily: "inherit", width: "100%" }} />

                  {/* Role */}
                  <select value={row.role} onChange={e => updateRow(row.id, "role", e.target.value)}
                    style={{ height: 32, padding: "0 8px", fontSize: 12, border: "1px solid #E9ECF0", borderRadius: 7, background: "#fff", color: "#0F172A", fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>

                  {/* Remove */}
                  <button type="button" onClick={() => removeRow(row.id)}
                    style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 16, borderRadius: 6 }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#DC2626"; e.currentTarget.style.background = "#FEF2F2"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "#9CA3AF"; e.currentTarget.style.background = "none"; }}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {filledRows.length > 0 && (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#9CA3AF" }}>
              {filledRows.length} invite{filledRows.length > 1 ? "s" : ""} will be sent
            </p>
          )}

          {/* Solo tip callout */}
          <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(201,169,110,0.10)", border: "1px dashed #C9A96E", borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 16, color: "#C9A96E", flexShrink: 0 }}>✦</span>
            <p style={{ margin: 0, fontSize: 13, color: "#0F172A", lineHeight: 1.5 }}>
              <strong>Working solo?</strong> Skip this step — add teammates from <strong>Team &amp; Schedule</strong> anytime after onboarding.
            </p>
          </div>
        </>
      )}
    </StepCard>
  );
}
