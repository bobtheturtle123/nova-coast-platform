"use client";

export default function BrochureClient({ pw, booking, images, branding, listingUrl }) {
  const address  = pw.customName || pw.address || booking.fullAddress || booking.address || "Property";
  const heroImg  = pw.heroImageUrl || images[0]?.url || null;
  const gridImgs = images.slice(heroImg === images[0]?.url ? 1 : 0, 5);

  const stats = [
    pw.beds      && { label: "Bedrooms",  value: pw.beds },
    pw.baths     && { label: "Bathrooms", value: pw.baths },
    pw.sqft      && { label: "Sq Ft",     value: Number(String(pw.sqft).replace(/,/g, "") || 0).toLocaleString() },
    pw.lotAcres  && { label: "Acres",     value: pw.lotAcres },
    pw.parking   && { label: "Parking",   value: pw.parking },
  ].filter(Boolean).slice(0, 4);

  // Luxury palette — deep neutral + warm metallic. Falls back to brand colors.
  const ink    = branding.primary || "#1A1A1A";
  const gold    = branding.accent || "#B08D57";
  const paper   = "#FBFAF7";

  const qrUrl = listingUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(listingUrl)}&size=140x140&color=1A1A1A&bgcolor=FBFAF7&margin=2`
    : null;

  return (
    <>
      {/* Controls (screen only) */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button onClick={() => window.print()}
          style={{ background: ink, color: paper, letterSpacing: "0.08em" }}
          className="text-xs font-semibold uppercase px-6 py-3 rounded-sm shadow-lg hover:opacity-90 transition-opacity">
          Save as PDF
        </button>
        <button onClick={() => window.close()}
          className="bg-white text-gray-600 text-xs font-medium uppercase tracking-wide px-4 py-3 rounded-sm shadow border border-gray-200 hover:bg-gray-50 transition-colors">
          Close
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Jost:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Jost', sans-serif; background: #DEDDD8; color: #1A1A1A; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .brochure { background: ${paper}; max-width: 820px; margin: 0 auto; }
        .serif { font-family: 'Cormorant Garamond', Georgia, serif; }
        .tracking { letter-spacing: 0.28em; }
        @media print {
          body { background: ${paper}; }
          .brochure { max-width: 100%; margin: 0; box-shadow: none !important; }
          @page { margin: 0; size: letter; }
        }
      `}</style>

      <div className="brochure" style={{ boxShadow: "0 10px 60px rgba(0,0,0,0.2)" }}>

        {/* ── HEADER ── */}
        <div style={{ padding: "26px 48px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid #E7E3DB` }}>
          {branding.logo ? (
            <img src={branding.logo} alt={branding.bizName} style={{ height: 32, objectFit: "contain" }} />
          ) : (
            <span className="serif" style={{ color: ink, fontWeight: 500, fontSize: 19, letterSpacing: "0.04em" }}>{branding.bizName}</span>
          )}
          {pw.status && (
            <span className="tracking" style={{ color: gold, fontSize: 9.5, fontWeight: 500, textTransform: "uppercase" }}>
              {pw.status}
            </span>
          )}
        </div>

        {/* ── HERO ── */}
        <div style={{ position: "relative", height: 420, background: "#111", overflow: "hidden" }}>
          {heroImg ? (
            <img src={heroImg} alt={address} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${ink}, #000)` }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 45%)" }} />
          {/* thin gold frame */}
          <div style={{ position: "absolute", inset: 16, border: "1px solid rgba(255,255,255,0.35)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: 36, left: 44, right: 44, textAlign: "center" }}>
            <div className="tracking" style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: 400, textTransform: "uppercase", marginBottom: 12 }}>
              {[pw.city, pw.state].filter(Boolean).join(", ") || "Presented For Sale"}
            </div>
            <div className="serif" style={{ color: "#fff", fontWeight: 400, fontSize: 38, lineHeight: 1.15, letterSpacing: "0.01em" }}>
              {address}
            </div>
            {pw.price && (
              <div className="serif" style={{ color: gold, fontSize: 22, fontWeight: 500, marginTop: 12, letterSpacing: "0.04em" }}>
                {pw.price}
              </div>
            )}
          </div>
        </div>

        {/* ── STATS ── */}
        {stats.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 0, padding: "26px 48px", borderBottom: "1px solid #E7E3DB" }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                flex: "1 1 0", textAlign: "center",
                borderLeft: i > 0 ? "1px solid #E7E3DB" : "none", padding: "0 14px",
              }}>
                <div className="serif" style={{ fontWeight: 500, fontSize: 30, color: ink, lineHeight: 1 }}>{s.value}</div>
                <div className="tracking" style={{ fontSize: 9, color: "#9A8F7E", textTransform: "uppercase", marginTop: 7, fontWeight: 400 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── BODY ── */}
        <div style={{ padding: "34px 48px 30px", display: "grid", gridTemplateColumns: "1fr 230px", gap: 40 }}>

          {/* LEFT */}
          <div>
            {pw.description && (
              <div style={{ marginBottom: 30 }}>
                <div className="tracking serif" style={{ fontSize: 13, fontWeight: 500, color: gold, textTransform: "uppercase", marginBottom: 12, fontStyle: "italic", letterSpacing: "0.12em" }}>
                  The Residence
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.85, color: "#3A352E", fontWeight: 300 }}>{pw.description}</p>
              </div>
            )}

            {pw.features?.length > 0 && (
              <div style={{ marginBottom: 30 }}>
                <div className="tracking serif" style={{ fontSize: 13, fontWeight: 500, color: gold, textTransform: "uppercase", marginBottom: 14, fontStyle: "italic", letterSpacing: "0.12em" }}>
                  Features
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "9px 24px" }}>
                  {pw.features.slice(0, 12).map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, color: "#3A352E", fontWeight: 300 }}>
                      <span style={{ color: gold, marginTop: 7, flexShrink: 0, width: 5, height: 5, background: gold, borderRadius: "50%" }} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photo grid */}
            {gridImgs.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                {gridImgs.map((img, i) => (
                  <div key={i} style={{ aspectRatio: "4/3", overflow: "hidden" }}>
                    <img src={img.url} alt={`View ${i + 2}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Agent */}
            <div style={{ textAlign: "center", padding: "4px 0 20px", borderBottom: "1px solid #E7E3DB" }}>
              {pw.agentPhoto ? (
                <img src={pw.agentPhoto} alt={pw.agentName}
                  style={{ width: 78, height: 78, borderRadius: "50%", objectFit: "cover", margin: "0 auto 14px", border: `1px solid ${gold}`, padding: 3 }} />
              ) : (
                <div style={{ width: 78, height: 78, borderRadius: "50%", background: ink, display: "flex", alignItems: "center", justifyContent: "center", color: paper, fontWeight: 400, fontSize: 26, margin: "0 auto 14px" }} className="serif">
                  {(pw.agentName || "A")[0].toUpperCase()}
                </div>
              )}
              <div className="serif" style={{ color: ink, fontWeight: 500, fontSize: 19, lineHeight: 1.2 }}>
                {pw.agentName || "Contact Agent"}
              </div>
              {pw.agentBrokerage && (
                <div className="tracking" style={{ color: "#9A8F7E", fontSize: 9, marginTop: 6, textTransform: "uppercase" }}>
                  {pw.agentBrokerage}
                </div>
              )}
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                {[pw.agentPhone, pw.agentEmail, branding.website].filter(Boolean).map((label, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#5A5349", wordBreak: "break-all", fontWeight: 300 }}>{label}</div>
                ))}
              </div>
              {pw.agentLogoUrl && (
                <img src={pw.agentLogoUrl} alt="" style={{ height: 22, maxWidth: "70%", objectFit: "contain", margin: "14px auto 0" }} />
              )}
            </div>

            {/* QR */}
            {qrUrl && (
              <div style={{ textAlign: "center" }}>
                <img src={qrUrl} alt="View listing" style={{ width: 110, height: 110, display: "block", margin: "0 auto 10px" }} />
                <div className="tracking" style={{ fontSize: 8.5, color: "#9A8F7E", textTransform: "uppercase", lineHeight: 1.7 }}>
                  Scan To View<br />Photos &amp; Tour
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ borderTop: "1px solid #E7E3DB", padding: "16px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 9.5, color: "#B0A698", fontWeight: 300, maxWidth: 440 }}>
            All information deemed reliable but not guaranteed.
          </div>
          <div className="serif" style={{ fontSize: 14, fontWeight: 500, color: ink, letterSpacing: "0.04em" }}>
            {branding.bizName}
          </div>
        </div>
      </div>
    </>
  );
}
