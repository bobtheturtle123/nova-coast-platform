"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    await saveOnboarding({
      completed:   { ...(onboarding?.completed || {}), review: true },
      completedAt: new Date().toISOString(),
      currentStep: 5,
    });
    await patch({ onboardingCompleted: true, starterGuideCompleted: false }).catch(() => {});
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
          <button className="btn-ghost" onClick={() => router.push("/onboarding/service-area")}>← Back to Service Area</button>
          <button className="btn-primary" onClick={handleFinish} disabled={finishing}>
            {finishing ? "Finishing…" : "Finish setup"}
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

      {/* "Next step" gold card */}
      <div style={{
        padding: "24px 28px", borderRadius: 16,
        background: "linear-gradient(135deg, rgba(201,169,110,0.12) 0%, rgba(168,132,63,0.08) 100%)",
        border: "1.5px solid #E8C97A",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #C9A96E, #A8843F)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 22 }}>✦</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Finish setting up your business</p>
            <p style={{ margin: "6px 0 16px", fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>
              Configure your booking preferences, pricing, and business details so everything is ready for clients.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-ghost"
                onClick={() => handleFinish("/dashboard?welcome=1")}
                disabled={finishing}
                style={{ fontSize: 13 }}>
                {finishing ? "Finishing…" : "Skip to dashboard"}
              </button>
              <button
                onClick={() => handleFinish("/dashboard/settings")}
                disabled={finishing}
                style={{ height: 36, padding: "0 18px", background: "linear-gradient(135deg, #C9A96E, #A8843F)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: finishing ? 0.7 : 1, boxShadow: "0 2px 8px rgba(168,132,63,0.28)" }}>
                {finishing ? "Finishing…" : "Go to Settings →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </StepCard>
  );
}
