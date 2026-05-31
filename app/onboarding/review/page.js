"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useOnboarding, StepCard } from "../ctx";

function SummaryRow({ icon, title, summary, editHref }) {
  const router = useRouter();
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "16px 0", borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF4FA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{title}</p>
        <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6B7280" }}>{summary}</p>
      </div>
      <button
        onClick={() => router.push(editHref)}
        style={{ fontSize: 12, color: "#3486cf", fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6, flexShrink: 0 }}
        onMouseEnter={e => e.currentTarget.style.background = "#EEF4FA"}
        onMouseLeave={e => e.currentTarget.style.background = "none"}>
        Edit
      </button>
    </div>
  );
}

export default function ReviewStep() {
  const router = useRouter();
  const { tenant, onboarding, saveOnboarding, patch } = useOnboarding();
  const [finishing, setFinishing] = useState(false);

  async function handleFinish(redirectTo = "/dashboard?welcome=1") {
    setFinishing(true);
    try {
      await saveOnboarding({
        completed:   { ...(onboarding?.completed || {}), review: true },
        completedAt: new Date().toISOString(),
        currentStep: 5,
      });
      await patch({ onboardingCompleted: true, starterGuideCompleted: false }).catch(() => {});
      // Fire-and-forget billing sync — do NOT await this; it can be slow and
      // must never block navigation to the dashboard.
      auth.currentUser?.getIdToken().then(tok =>
        fetch("/api/billing/sync", { headers: { Authorization: `Bearer ${tok}` } })
      ).catch(() => {});
    } catch {
      setFinishing(false);
      return;
    }
    router.push(redirectTo);
  }

  // Build summary lines
  const brandingName  = tenant?.branding?.name || tenant?.businessName || "";
  const brandingColor = tenant?.branding?.primaryColor || "";
  const brandingSummary = brandingName
    ? `${brandingName}${brandingColor ? ` · ${brandingColor}` : ""}${tenant?.branding?.logoUrl ? " · logo uploaded" : ""}`
    : "Skipped";

  const stripeSummary = tenant?.stripeConnectOnboarded
    ? `Connected · payouts to ••••${tenant?.stripe?.payoutMethodLast4 || "????"}`
    : onboarding?.skipped?.stripe
    ? "Skipped — connect later from Billing"
    : "Not connected";

  const teamInvites = onboarding?.teamInvites || [];
  const teamSummary = teamInvites.length > 0
    ? `${teamInvites.length} invite${teamInvites.length > 1 ? "s" : ""} sent · ${teamInvites.map(i => i.name || i.email).join(", ")}`
    : onboarding?.skipped?.team
    ? "Skipped — add teammates later from Team & Schedule"
    : "Solo studio";

  // We'll fetch zone count from onboarding state if stored, or just show "zones drawn"
  const serviceAreaSummary = onboarding?.skipped?.serviceArea
    ? "Skipped — set up zones later from Service Areas"
    : onboarding?.completed?.serviceArea
    ? "Zones drawn — review them in Service Areas"
    : "Not completed";

  return (
    <StepCard
      eyebrow="Step 5 of 5 · Review"
      headline="Studio is ready."
      lede="Here's what you've set up. You can change any of it from Settings later."
      footer={
        <>
          <button className="btn-ghost" onClick={() => router.push("/onboarding/service-area")}>← Back</button>
          <button className="btn-primary" onClick={() => handleFinish("/dashboard?welcome=1")} disabled={finishing}>
            {finishing ? "Opening dashboard…" : "Go to dashboard →"}
          </button>
        </>
      }
    >
      {/* Summary rows */}
      <div style={{ marginBottom: 28 }}>
        <SummaryRow icon="🎨" title="Branding"      summary={brandingSummary}    editHref="/onboarding/branding"     />
        <SummaryRow icon="💳" title="Stripe Connect" summary={stripeSummary}      editHref="/onboarding/stripe"       />
        <SummaryRow icon="👥" title="Team"           summary={teamSummary}        editHref="/onboarding/team"         />
        <div style={{ borderBottom: "none" }}>
          <SummaryRow icon="📍" title="Service Area" summary={serviceAreaSummary} editHref="/onboarding/service-area" />
        </div>
      </div>

      {/* Tip card */}
      <div style={{
        padding: "18px 22px", borderRadius: 14,
        background: "linear-gradient(135deg, rgba(201,169,110,0.10) 0%, rgba(168,132,63,0.06) 100%)",
        border: "1.5px solid #E8C97A",
        display: "flex", alignItems: "flex-start", gap: 14,
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>✦</span>
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>Ready to go</p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#6B7280", lineHeight: 1.6 }}>
            Your workspace is configured. Hit "Go to dashboard" below to start managing bookings.
            You can tweak branding, pricing, and availability any time from Settings.
          </p>
        </div>
      </div>
    </StepCard>
  );
}
