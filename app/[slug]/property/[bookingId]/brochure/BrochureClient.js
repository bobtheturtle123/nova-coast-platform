"use client";

import { useEffect } from "react";

export default function BrochureClient({ pw, booking, images, branding, listingUrl }) {
  const address  = pw.customName || pw.address || booking.fullAddress || booking.address || "Property";
  const heroImg  = pw.heroImageUrl || images[0]?.url || null;
  const gridImgs = images.slice(heroImg === images[0]?.url ? 1 : 0, 7);

  const stats = [
    pw.beds      && { label: "Bedrooms",  value: pw.beds },
    pw.baths     && { label: "Bathrooms", value: pw.baths },
    pw.sqft      && { label: "Sq Ft",     value: Number(String(pw.sqft).replace(/,/g, "") || 0).toLocaleString() },
    pw.parking   && { label: "Parking",   value: pw.parking },
    pw.lotAcres  && { label: "Lot",       value: `${pw.lotAcres} ac` },
    pw.type      && { label: "Type",      value: pw.type },
    pw.yearBuilt && { label: "Year Built",value: pw.yearBuilt },
  ].filter(Boolean);

  const primary = branding.primary || "#1B3A5C";
  const accent  = branding.accent  || "#C9A96E";

  const qrUrl = listingUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(listingUrl)}&size=120x120&color=${primary.replace("#","")}&bgcolor=FAFAF8&margin=6`
    : null;

  useEffect(() => {
    const timer = setTimeout(() => {}, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Controls (print only) */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          style={{ background: primary, color: "white", letterSpacing: "0.05em" }}
          className="text-sm font-semibold px-5 py-2.5 rounded-md shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Save as PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-white text-gray-500 text-sm font-medium px-4 py-2.5 rounded-md shadow border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #EBEBEB; color: #1C1C1C; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .brochure { background: #FAFAF8; max-width: 820px; margin: 0 auto; }
        .serif { font-family: 'Cormorant Garamond', Georgia, serif; }
        @media print {
          body { background: #FAFAF8; }
          .brochure { max-width: 100%; margin: 0; box-shadow: none !important; }
          @page { margin: 0; size: letter; }
        }
      `}</style>

      <div className="brochure" style={{ boxShadow: "0 8px 60px rgba(0,0,0,0.18)" }}>

        {/* ── HEADER ── */}
        <div style={{
          background: "#FAFAF8",
          borderBottom: `3px solid ${primary}`,
          padding: "18px 36px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {branding.logo ? (
              <img src={branding.logo} alt={branding.bizName}
                style={{ height: 34, objectFit: "contain" }} />
            ) : (
              <span className="serif" style={{ color: primary, fontWeight: 500, fontSize: 22, letterSpacing: "0.03em" }}>
                {branding.bizName}
              </span>
            )}
            {branding.tagline && (
              <span style={{
                color: "#999", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
                borderLeft: "1px solid #DDD", paddingLeft: 14, marginLeft: 2,
              }}>
                {branding.tagline}
              </span>
            )}
          </div>
          {pw.status && (
            <span style={{
              background: pw.status === "For Sale" ? "#E8F5EE" : pw.status === "Sold" ? "#FEE2E2" : pw.status === "Pending" ? "#FEF3C7" : "#EEF3FB",
              color:      pw.status === "For Sale" ? "#166534" : pw.status === "Sold" ? "#991B1B" : pw.status === "Pending" ? "#92400E" : primary,
              fontWeight: 600, fontSize: 10, padding: "5px 14px",
              letterSpacing: "0.16em", textTransform: "uppercase",
              border: `1px solid currentColor`, borderRadius: 2,
            }}>
              {pw.status}
            </span>
          )}
        </div>

        {/* ── HERO ── */}
        <div style={{ position: "relative", height: 360, background: "#1C1C1C", overflow: "hidden" }}>
          {heroImg ? (
            <img src={heroImg} alt={address}
              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.88 }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${primary}, #0a1628)` }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.05) 55%)" }} />

          {/* Accent rule along bottom */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: accent }} />

          <div style={{ position: "absolute", bottom: 28, left: 36, right: 36 }}>
            {pw.price && (
              <div className="serif" style={{ color: accent, fontSize: 20, fontWeight: 400, letterSpacing: "0.04em", marginBottom: 8 }}>
                {pw.price}
              </div>
            )}
            <div className="serif" style={{ color: "white", fontWeight: 300, fontSize: 34, lineHeight: 1.2, letterSpacing: "0.01em" }}>
              {address}
            </div>
            {(pw.city || pw.state) && (
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 8, fontWeight: 300 }}>
                {[pw.city, pw.state].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        </div>

        {/* ── STATS BAR ── */}
        {stats.length > 0 && (
          <div style={{
            background: primary, display: "flex", flexWrap: "wrap",
          }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                flex: "1 1 auto", minWidth: 70, textAlign: "center",
                padding: "14px 10px",
                borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.15)" : "none",
              }}>
                <div className="serif" style={{ fontWeight: 400, fontSize: 24, color: "white", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.14em", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── BODY ── */}
        <div style={{ padding: "32px 36px 28px", display: "grid", gridTemplateColumns: "1fr 215px", gap: 30, background: "#FAFAF8" }}>

          {/* LEFT */}
          <div>
            {pw.description && (
              <div style={{ marginBottom: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 2, background: accent }} />
                  <div style={{ fontSize: 9, fontWeight: 600, color: primary, textTransform: "uppercase", letterSpacing: "0.2em" }}>
                    About This Property
                  </div>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.85, color: "#4A4A4A", fontWeight: 300 }}>{pw.description}</p>
              </div>
            )}

            {pw.features?.length > 0 && (
              <div style={{ marginBottom: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 2, background: accent }} />
                  <div style={{ fontSize: 9, fontWeight: 600, color: primary, textTransform: "uppercase", letterSpacing: "0.2em" }}>
                    Features &amp; Highlights
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 18px" }}>
                  {pw.features.slice(0, 12).map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: "#4A4A4A", fontWeight: 300 }}>
                      <span style={{ color: accent, fontWeight: 700, marginTop: 1, flexShrink: 0, fontSize: 10 }}>✦</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photo grid */}
            {gridImgs.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
                {gridImgs.map((img, i) => (
                  <div key={i} style={{ aspectRatio: "4/3", overflow: "hidden" }}>
                    <img src={img.url} alt={`Photo ${i + 2}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Agent card */}
            <div style={{ border: `1px solid #E5E2DC`, overflow: "hidden" }}>
              <div style={{ background: primary, padding: "14px 16px" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 10 }}>
                  Listing Agent
                </div>
                {pw.agentPhoto ? (
                  <img src={pw.agentPhoto} alt={pw.agentName}
                    style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: `2px solid ${accent}`, marginBottom: 9 }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: `1px solid rgba(255,255,255,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 500, fontSize: 18, marginBottom: 9 }}>
                    {(pw.agentName || "A")[0].toUpperCase()}
                  </div>
                )}
                <div className="serif" style={{ color: "white", fontWeight: 400, fontSize: 16, lineHeight: 1.25 }}>
                  {pw.agentName || "Contact Agent"}
                </div>
                {pw.agentBrokerage && (
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, marginTop: 3 }}>
                    {pw.agentBrokerage}
                  </div>
                )}
              </div>

              <div style={{ padding: "13px 16px", background: "#FAFAF8" }}>
                {pw.agentLogoUrl && (
                  <div style={{ marginBottom: 11, paddingBottom: 10, borderBottom: "1px solid #EEE" }}>
                    <img src={pw.agentLogoUrl} alt={pw.agentBrokerage || "Brokerage"}
                      style={{ height: 24, maxWidth: "100%", objectFit: "contain" }} />
                  </div>
                )}
                {[
                  pw.agentPhone   && { prefix: "T ", label: pw.agentPhone },
                  pw.agentEmail   && { prefix: "E ", label: pw.agentEmail },
                  branding.website && { prefix: "W ", label: branding.website },
                ].filter(Boolean).map(({ prefix, label }, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, fontSize: 11, color: "#555", marginBottom: 6, wordBreak: "break-all", fontWeight: 300 }}>
                    <span style={{ color: accent, fontWeight: 600, flexShrink: 0, fontSize: 10 }}>{prefix}</span>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* QR */}
            {qrUrl && (
              <div style={{ border: "1px solid #E5E2DC", padding: "14px 16px", textAlign: "center", background: "#FAFAF8" }}>
                <img src={qrUrl} alt="View listing online"
                  style={{ width: 96, height: 96, display: "block", margin: "0 auto 9px" }} />
                <div style={{ fontSize: 10, color: "#999", lineHeight: 1.5, letterSpacing: "0.02em" }}>
                  Scan to view photos &amp; virtual tour
                </div>
              </div>
            )}

            {/* Details mini-table */}
            {(pw.price || pw.mlsNumber || pw.yearBuilt || pw.lotAcres) && (
              <div style={{ border: "1px solid #E5E2DC", overflow: "hidden" }}>
                <div style={{ background: "#F0EDE8", padding: "9px 14px", borderBottom: "1px solid #E5E2DC" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: primary, textTransform: "uppercase", letterSpacing: "0.18em" }}>
                    Property Details
                  </div>
                </div>
                {[
                  pw.price     && ["Asking Price", pw.price],
                  pw.mlsNumber && ["MLS #",        pw.mlsNumber],
                  pw.yearBuilt && ["Year Built",   pw.yearBuilt],
                  pw.lotAcres  && ["Lot Size",     `${pw.lotAcres} ac`],
                ].filter(Boolean).map(([label, val], i, arr) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 14px", fontSize: 11,
                    borderBottom: i < arr.length - 1 ? "1px solid #F0EDE8" : "none",
                    background: i % 2 === 0 ? "#FAFAF8" : "#F7F5F1",
                  }}>
                    <span style={{ color: "#888", fontWeight: 300 }}>{label}</span>
                    <span className="serif" style={{ fontWeight: 500, color: "#1C1C1C", fontSize: 12 }}>{val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          background: "#F0EDE8",
          borderTop: `1px solid #E5E2DC`,
          padding: "12px 36px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ fontSize: 10, color: "#AAA", letterSpacing: "0.02em", fontWeight: 300 }}>
            All information deemed reliable but not guaranteed. Not intended to solicit listed properties.
          </div>
          <div className="serif" style={{ fontSize: 13, fontWeight: 400, color: primary, letterSpacing: "0.04em" }}>
            {branding.bizName}
          </div>
        </div>

      </div>
    </>
  );
}
