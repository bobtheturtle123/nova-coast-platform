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

  const qrUrl = listingUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(listingUrl)}&size=120x120&color=C9A96E&bgcolor=0D0D0D&margin=6`
    : null;

  useEffect(() => {
    const timer = setTimeout(() => {}, 500);
    return () => clearTimeout(timer);
  }, []);

  // Resolve accent — if branding provides one use it, otherwise gold
  const gold = "#C9A96E";

  return (
    <>
      {/* Print / close controls */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="text-sm font-semibold px-5 py-2.5 rounded-sm shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          style={{ background: gold, color: "#0D0D0D", letterSpacing: "0.05em" }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Save as PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-sm border border-white/20 hover:bg-white/20 transition-colors"
        >
          Close
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #111; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .brochure { background: #0D0D0D; max-width: 820px; margin: 0 auto; }
        .serif { font-family: 'Playfair Display', Georgia, serif; }
        .gold { color: ${gold}; }
        .gold-line { height: 1px; background: linear-gradient(to right, transparent, ${gold}, transparent); }
        @media print {
          body { background: #0D0D0D; }
          .brochure { max-width: 100%; margin: 0; }
          @page { margin: 0; size: letter; }
        }
      `}</style>

      <div className="brochure" style={{ boxShadow: "0 0 80px rgba(0,0,0,0.8)" }}>

        {/* ── HEADER ── */}
        <div style={{ background: "#0D0D0D", borderBottom: `1px solid rgba(201,169,110,0.25)`, padding: "20px 36px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {branding.logo ? (
              <img src={branding.logo} alt={branding.bizName}
                style={{ height: 30, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
            ) : (
              <span className="serif" style={{ color: "white", fontWeight: 400, fontSize: 20, letterSpacing: "0.05em" }}>
                {branding.bizName}
              </span>
            )}
            {branding.tagline && (
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: 14, marginLeft: 2 }}>
                {branding.tagline}
              </span>
            )}
          </div>
          {pw.status && (
            <span style={{
              background: "transparent",
              border: `1px solid ${gold}`,
              color: gold,
              fontWeight: 500,
              fontSize: 10,
              padding: "5px 14px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}>
              {pw.status}
            </span>
          )}
        </div>

        {/* ── HERO ── */}
        <div style={{ position: "relative", height: 380, background: "#0a0a0a", overflow: "hidden" }}>
          {heroImg ? (
            <img src={heroImg} alt={address}
              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, #1a1a1a, #0D0D0D)` }} />
          )}
          {/* Gradient overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(13,13,13,0.92) 0%, rgba(13,13,13,0.15) 55%, transparent 100%)" }} />
          {/* Thin gold top bar */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(to right, transparent, ${gold} 30%, ${gold} 70%, transparent)` }} />

          <div style={{ position: "absolute", bottom: 32, left: 36, right: 36 }}>
            {pw.price && (
              <div className="serif" style={{ color: gold, fontSize: 18, fontWeight: 400, letterSpacing: "0.06em", marginBottom: 10 }}>
                {pw.price}
              </div>
            )}
            <div className="serif" style={{ color: "white", fontWeight: 400, fontSize: 30, lineHeight: 1.25, letterSpacing: "-0.02em" }}>
              {address}
            </div>
            {(pw.city || pw.state) && (
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 8 }}>
                {[pw.city, pw.state].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        </div>

        {/* ── STATS BAR ── */}
        {stats.length > 0 && (
          <div style={{ background: "#111", borderTop: `1px solid rgba(201,169,110,0.2)`, borderBottom: `1px solid rgba(201,169,110,0.2)`, display: "flex", flexWrap: "wrap" }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                flex: "1 1 auto", minWidth: 70, textAlign: "center",
                padding: "16px 12px",
                borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}>
                <div className="serif" style={{ fontWeight: 400, fontSize: 22, color: gold, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.14em", marginTop: 5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── BODY ── */}
        <div style={{ padding: "36px 36px 32px", display: "grid", gridTemplateColumns: "1fr 220px", gap: 32, background: "#0D0D0D" }}>

          {/* LEFT: description + features + photo grid */}
          <div>

            {pw.description && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: gold, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 14 }}>
                  About This Property
                </div>
                <div className="gold-line" style={{ marginBottom: 14 }} />
                <p style={{ fontSize: 13, lineHeight: 1.85, color: "rgba(255,255,255,0.6)", fontWeight: 300 }}>{pw.description}</p>
              </div>
            )}

            {pw.features?.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: gold, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 14 }}>
                  Features &amp; Highlights
                </div>
                <div className="gold-line" style={{ marginBottom: 14 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
                  {pw.features.slice(0, 12).map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 300 }}>
                      <span style={{ color: gold, fontSize: 10, marginTop: 2, flexShrink: 0 }}>◆</span>
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
                      style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.92)" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: agent card + QR + details */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Agent card */}
            <div style={{ border: `1px solid rgba(201,169,110,0.25)`, overflow: "hidden" }}>
              <div style={{ background: "#111", padding: "16px 18px", borderBottom: `1px solid rgba(201,169,110,0.15)` }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 12 }}>
                  Listing Agent
                </div>
                {pw.agentPhoto ? (
                  <img src={pw.agentPhoto} alt={pw.agentName}
                    style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", border: `1px solid rgba(201,169,110,0.4)`, marginBottom: 10 }} />
                ) : (
                  <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(201,169,110,0.1)", border: `1px solid rgba(201,169,110,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", color: gold, fontWeight: 500, fontSize: 18, marginBottom: 10 }}>
                    {(pw.agentName || "A")[0].toUpperCase()}
                  </div>
                )}
                <div className="serif" style={{ color: "white", fontWeight: 400, fontSize: 15, lineHeight: 1.3 }}>
                  {pw.agentName || "Contact Agent"}
                </div>
                {pw.agentBrokerage && (
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 4, letterSpacing: "0.04em" }}>
                    {pw.agentBrokerage}
                  </div>
                )}
              </div>

              <div style={{ padding: "14px 18px", background: "#0D0D0D" }}>
                {pw.agentLogoUrl && (
                  <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <img src={pw.agentLogoUrl} alt={pw.agentBrokerage || "Brokerage"}
                      style={{ height: 24, maxWidth: "100%", objectFit: "contain", filter: "brightness(0) invert(1) opacity(0.5)" }} />
                  </div>
                )}
                {[
                  pw.agentPhone && { icon: "T", label: pw.agentPhone },
                  pw.agentEmail && { icon: "E", label: pw.agentEmail },
                  branding.website && { icon: "W", label: branding.website },
                ].filter(Boolean).map(({ icon, label }, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 7, wordBreak: "break-all", fontWeight: 300 }}>
                    <span style={{ color: gold, fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", flexShrink: 0, marginTop: 1 }}>{icon}</span>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* QR code */}
            {qrUrl && (
              <div style={{ border: `1px solid rgba(201,169,110,0.25)`, padding: "16px 18px", textAlign: "center", background: "#111" }}>
                <img src={qrUrl} alt="Scan for listing"
                  style={{ width: 100, height: 100, display: "block", margin: "0 auto 10px" }} />
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1.5, letterSpacing: "0.04em" }}>
                  Scan to view the full listing with photos &amp; virtual tour
                </div>
              </div>
            )}

            {/* Property details */}
            {(pw.price || pw.mlsNumber || pw.yearBuilt) && (
              <div style={{ border: `1px solid rgba(201,169,110,0.25)`, overflow: "hidden" }}>
                <div style={{ background: "#111", padding: "10px 16px", borderBottom: `1px solid rgba(201,169,110,0.12)` }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: gold, textTransform: "uppercase", letterSpacing: "0.18em" }}>
                    Property Details
                  </div>
                </div>
                <div style={{ background: "#0D0D0D" }}>
                  {[
                    pw.price     && ["Asking Price", pw.price],
                    pw.mlsNumber && ["MLS #",        pw.mlsNumber],
                    pw.yearBuilt && ["Year Built",   pw.yearBuilt],
                    pw.lotAcres  && ["Lot Size",     `${pw.lotAcres} acres`],
                  ].filter(Boolean).map(([label, val], i, arr) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "9px 16px",
                      borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      fontSize: 11,
                    }}>
                      <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 300, letterSpacing: "0.04em" }}>{label}</span>
                      <span className="serif" style={{ fontWeight: 400, color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          borderTop: `1px solid rgba(201,169,110,0.2)`,
          padding: "14px 36px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#0a0a0a",
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", letterSpacing: "0.04em", fontWeight: 300 }}>
            All information deemed reliable but not guaranteed. Not intended to solicit listed properties.
          </div>
          <div className="serif" style={{ fontSize: 12, fontWeight: 400, color: "rgba(201,169,110,0.6)", letterSpacing: "0.06em" }}>
            {branding.bizName}
          </div>
        </div>

      </div>
    </>
  );
}
