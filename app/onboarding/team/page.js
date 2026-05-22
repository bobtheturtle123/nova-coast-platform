"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useOnboarding, StepCard } from "../ctx";
import { avatarColor, initials } from "@/lib/avatar";

const ROLES = ["photographer", "editor", "coordinator", "admin"];

function emptyRow() {
  return { id: Date.now() + Math.random(), name: "", email: "", role: "photographer" };
}

export default function TeamStep() {
  const router = useRouter();
  const { onboarding, saveOnboarding } = useOnboarding();

  const [rows,   setRows]   = useState([emptyRow()]);
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]  = useState("");

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
    setSending(true); setError("");
    try {
      const token = await auth.currentUser.getIdToken();
      for (const row of filledRows) {
        await fetch("/api/dashboard/team/invite", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ email: row.email.trim(), role: row.role }),
        });
      }
      setSent(true);
      await saveOnboarding({
        completed: { ...(onboarding?.completed || {}), team: true },
        teamInvites: filledRows.map(r => ({ name: r.name, email: r.email, role: r.role })),
        currentStep: 4,
      });
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
      lede="Invite photographers, editors, or coordinators. They'll get their own login and only see what they need. You can add more anytime."
      footer={
        <>
          <button className="btn-ghost" onClick={() => router.push("/onboarding/stripe")}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn-ghost" onClick={handleSkip}>Skip — I&apos;m solo</button>
            <button
              className="btn-primary"
              onClick={handleSend}
              disabled={sending || sent}>
              {ctaLabel}
            </button>
          </div>
        </>
      }
    >
      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 9, fontSize: 13, color: "#DC2626" }}>
          {error}
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
          <strong>Solo studio?</strong> Skip this step — you can invite teammates later from <strong>Team &amp; Schedule</strong> anytime.
        </p>
      </div>
    </StepCard>
  );
}
