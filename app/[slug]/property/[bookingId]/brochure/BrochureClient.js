"use client";

import { useEffect } from "react";

export default function BrochureClient({ pw, booking, images, branding, listingUrl }) {
  const address  = pw.customName || pw.address || booking.fullAddress || booking.address || "Property";
  const heroImg  = pw.heroImageUrl || images[0]?.url || null;
  const gridImgs = images.slice(heroImg === images[0]?.url ? 1 : 0, 7);

  const stats = [
    pw.beds     && { label: "Beds",    value: pw.beds },
    pw.baths    && { label: "Baths",   value: pw.baths },
    pw.sqft     && { label: "Sq Ft",   value: Number(String(pw.sqft).replace(/,/g, "") || 0).toLocaleString() },
    pw.parking  && { label: "Parking", value: pw.parking },
    pw.lotAcres && { label: "Acres",   value: pw.lotAcres },
    pw.type     && { label: "Type",    value: pw.type },
    pw.yearBuilt && { label: "Built",  value: pw.yearBuilt },
  ].filter(Boolean);

  // Build QR code image URL using qrserver.com (free public API)
  const qrColor = branding.primary.replace("#", "");
  const qrUrl = listingUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(listingUrl)}&size=110x110&color=${qrColor}&bgcolor=ffffff&margin=4`
    : null;

  useEffect(() => {
    // Small delay so fonts/images can begin loading
    const timer = setTimeout(() => {}, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Print trigger button — hidden on print */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          style={{ background: branding.primary }}
          className="text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-white text-gray-500 text-sm font-medium px-4 py-2.5 rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #f8f8f8; color: #1a1a2e; }
        .brochure { background: white; max-width: 800px; margin: 0 auto; }
        @media print {
          body { background: white; }
          .brochure { max-width: 100%; margin: 0; }
          @page { margin: 0; size: letter; }
        }
      `}</style>

      <div className="brochure shadow-2xl print:shadow-none">

        {/* ── HEADER BAR ── */}
        <div style={{ background: branding.primary }} className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logo ? (
              <img src={branding.logo} alt={branding.bizName} style={{ height: 32, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
            ) : (
              <span style={{ color: "white", fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px" }}>
                {branding.bizName}
              </span>
            )}
            {branding.tagline && (
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginLeft: 8 }}>{branding.tagline}</span>
            )}
          </div>
          {pw.status && (
            <span style={{
              background: pw.status === "For Sale" ? "#22c55e" : pw.status === "Sold" ? "#ef4444" : pw.status === "Pending" ? "#f59e0b" : "#3b82f6",
              color: "white", fontWeight: 700, fontSize: 11, padding: "4px 12px", borderRadius: 20, letterSpacing: 1, textTransform: "uppercase",
            }}>
              {pw.status}
            </span>
          )}
        </div>

        {/* ── HERO ── */}
        <div style={{ position: "relative", height: 340, background: "#1a1a2e", overflow: "hidden" }}>
          {heroImg ? (
            <img src={heroImg} alt={address} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${branding.primary}, #1a1a2e)` }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 60%)" }} />
          <div style={{ position: "absolute", bottom: 24, left: 32, right: 32 }}>
            {pw.price && (
              <div style={{ display: "inline-block", background: branding.accent, color: "#1a1a2e", fontWeight: 800, fontSize: 26, padding: "6px 16px", borderRadius: 8, marginBottom: 10 }}>
                {pw.price}
              </div>
            )}
            <div style={{ color: "white", fontWeight: 800, fontSize: 28, lineHeight: 1.2, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
              {address}
            </div>
          </div>
        </div>

        {/* ── STATS BAR ── */}
        {stats.length > 0 && (
          <div style={{ background: "#f8f9fa", borderBottom: "1px solid #e8e8e8", display: "flex", flexWrap: "wrap" }}>
            {stats.map((s, i) => (
              <div key={i} style={{ flex: "1 1 auto", minWidth: 80, textAlign: "center", padding: "14px 12px", borderRight: i < stats.length - 1 ? "1px solid #e8e8e8" : "none" }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: branding.primary }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── BODY ── */}
        <div style={{ padding: "28px 32px", display: "grid", gridTemplateColumns: "1fr 240px", gap: 28 }}>

          {/* Left: description + features + photo grid */}
          <div>
            {pw.description && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: branding.accent, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
                  About This Property
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.75, color: "#444" }}>{pw.description}</p>
              </div>
            )}

            {pw.features?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: branding.accent, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                  Features & Highlights
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                  {pw.features.slice(0, 12).map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#444" }}>
                      <span style={{ color: branding.accent, fontWeight: 700, marginTop: 1 }}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photo grid */}
            {gridImgs.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                {gridImgs.map((img, i) => (
                  <div key={i} style={{ aspectRatio: "4/3", overflow: "hidden", borderRadius: 4 }}>
                    <img src={img.url} alt={`Photo ${i + 2}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: agent card + QR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Agent card */}
            <div style={{ border: `1px solid #e8e8e8`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ background: branding.primary, padding: "12px 16px" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Listing Agent</div>
                {pw.agentPhoto ? (
                  <img src={pw.agentPhoto} alt={pw.agentName} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.3)", marginBottom: 8 }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
                    {(pw.agentName || "A")[0].toUpperCase()}
                  </div>
                )}
                <div style={{ color: "white", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{pw.agentName || "Contact Agent"}</div>
                {pw.agentBrokerage && (
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>{pw.agentBrokerage}</div>
                )}
              </div>
              <div style={{ padding: "12px 16px", background: "#fafafa" }}>
                {pw.agentLogoUrl && (
                  <div style={{ marginBottom: 10 }}>
                    <img src={pw.agentLogoUrl} alt={pw.agentBrokerage || "Brokerage logo"}
                      style={{ height: 28, maxWidth: "100%", objectFit: "contain" }} />
                  </div>
                )}
                {pw.agentPhone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444", marginBottom: 6 }}>
                    <span style={{ color: branding.primary }}>📞</span> {pw.agentPhone}
                  </div>
                )}
                {pw.agentEmail && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444", marginBottom: 6, wordBreak: "break-all" }}>
                    <span style={{ color: branding.primary }}>✉️</span> {pw.agentEmail}
                  </div>
                )}
                {branding.website && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444" }}>
                    <span style={{ color: branding.primary }}>🌐</span> {branding.website}
                  </div>
                )}
              </div>
            </div>

            {/* QR code */}
            {qrUrl && (
              <div style={{ border: "1px solid #e8e8e8", borderRadius: 10, padding: 16, textAlign: "center", background: "#fafafa" }}>
                <img src={qrUrl} alt="Scan for listing" style={{ width: 110, height: 110, display: "block", margin: "0 auto 8px" }} />
                <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>Scan to view the full listing online with photos & virtual tour</div>
              </div>
            )}

            {/* Property details mini-table */}
            {(pw.price || pw.mlsNumber || pw.yearBuilt) && (
              <div style={{ border: "1px solid #e8e8e8", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ background: branding.primary, padding: "8px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1 }}>Details</div>
                </div>
                <div style={{ padding: "4px 0" }}>
                  {[
                    pw.price     && ["Asking Price", pw.price],
                    pw.mlsNumber && ["MLS #",        pw.mlsNumber],
                    pw.yearBuilt && ["Year Built",   pw.yearBuilt],
                    pw.lotAcres  && ["Lot",          `${pw.lotAcres} ac`],
                  ].filter(Boolean).map(([label, val], i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", borderBottom: "1px solid #f0f0f0", fontSize: 12 }}>
                      <span style={{ color: "#888" }}>{label}</span>
                      <span style={{ fontWeight: 600, color: "#1a1a2e" }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ borderTop: "1px solid #e8e8e8", padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
          <div style={{ fontSize: 11, color: "#aaa" }}>
            All information deemed reliable but not guaranteed. Not intended to solicit properties already listed.
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: branding.primary }}>{branding.bizName}</div>
        </div>
      </div>
    </>
  );
}
