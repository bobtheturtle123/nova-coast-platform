"use client";

export default function BrochureClient({ pw, booking, images, branding, listingUrl }) {
  const address  = pw.customName || pw.address || booking.fullAddress || booking.address || "Property";
  const heroImg  = pw.heroImageUrl || images[0]?.url || null;
  const gridImgs = images.slice(heroImg === images[0]?.url ? 1 : 0, 5);

  const stats = [
    pw.beds      && { label: "Beds",   value: pw.beds },
    pw.baths     && { label: "Baths",  value: pw.baths },
    pw.sqft      && { label: "Sq Ft",  value: Number(String(pw.sqft).replace(/,/g, "") || 0).toLocaleString() },
    pw.parking   && { label: "Parking",value: pw.parking },
    pw.lotAcres  && { label: "Lot",    value: `${pw.lotAcres} ac` },
  ].filter(Boolean).slice(0, 4);

  const primary = branding.primary || "#0F172A";
  const accent  = branding.accent  || "#C9A96E";

  const qrUrl = listingUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(listingUrl)}&size=160x160&color=${primary.replace("#","")}&bgcolor=FFFFFF&margin=4`
    : null;

  return (
    <>
      {/* Controls (screen only) */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          style={{ background: primary, color: "white" }}
          className="text-sm font-semibold px-5 py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Save as PDF
        </button>
        <button onClick={() => window.close()}
          className="bg-white text-gray-600 text-sm font-semibold px-4 py-3 rounded-xl shadow border border-gray-200 hover:bg-gray-50 transition-colors">
          Close
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #E9EAEC; color: #0F172A; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .brochure { background: #fff; max-width: 850px; margin: 0 auto; }
        .display { font-family: 'Fraunces', Georgia, serif; }
        @media print {
          body { background: #fff; }
          .brochure { max-width: 100%; margin: 0; box-shadow: none !important; }
          @page { margin: 0; size: letter; }
        }
      `}</style>

      <div className="brochure" style={{ boxShadow: "0 12px 70px rgba(0,0,0,0.22)" }}>

        {/* ── HEADER ── */}
        <div style={{ padding: "22px 44px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {branding.logo ? (
              <img src={branding.logo} alt={branding.bizName} style={{ height: 40, objectFit: "contain" }} />
            ) : (
              <span className="display" style={{ color: primary, fontWeight: 600, fontSize: 26, letterSpacing: "-0.01em" }}>
                {branding.bizName}
              </span>
            )}
          </div>
          {pw.status && (
            <span style={{
              background: primary, color: "#fff",
              fontWeight: 700, fontSize: 11, padding: "8px 18px",
              letterSpacing: "0.14em", textTransform: "uppercase", borderRadius: 999,
            }}>
              {pw.status}
            </span>
          )}
        </div>

        {/* ── HERO ── */}
        <div style={{ position: "relative", height: 430, background: "#0F172A", overflow: "hidden", margin: "0 24px", borderRadius: 20 }}>
          {heroImg ? (
            <img src={heroImg} alt={address} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${primary}, #0a1628)` }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.1) 50%)" }} />
          <div style={{ position: "absolute", bottom: 34, left: 38, right: 38 }}>
            {pw.price && (
              <div className="display" style={{ color: accent, fontSize: 30, fontWeight: 600, marginBottom: 6, letterSpacing: "-0.01em" }}>
                {pw.price}
              </div>
            )}
            <div className="display" style={{ color: "#fff", fontWeight: 600, fontSize: 50, lineHeight: 1.04, letterSpacing: "-0.02em" }}>
              {address}
            </div>
            {(pw.city || pw.state) && (
              <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 16, letterSpacing: "0.04em", marginTop: 12, fontWeight: 500 }}>
                {[pw.city, pw.state].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        </div>

        {/* ── STATS BAR ── */}
        {stats.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", margin: "26px 44px 0", borderRadius: 16, overflow: "hidden", border: "1px solid #EAEBEE" }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                flex: "1 1 0", minWidth: 90, textAlign: "center", padding: "20px 12px",
                borderRight: i < stats.length - 1 ? "1px solid #EAEBEE" : "none",
                background: "#fff",
              }}>
                <div className="display" style={{ fontWeight: 600, fontSize: 38, color: primary, lineHeight: 1, letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 8, fontWeight: 700 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── BODY ── */}
        <div style={{ padding: "32px 44px 36px", display: "grid", gridTemplateColumns: "1fr 250px", gap: 38 }}>

          {/* LEFT */}
          <div>
            {pw.description && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 14 }}>
                  About This Home
                </div>
                <p style={{ fontSize: 17, lineHeight: 1.7, color: "#334155", fontWeight: 400 }}>{pw.description}</p>
              </div>
            )}

            {pw.features?.length > 0 && (
              <div style={{ marginBottom: 30 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 14 }}>
                  Features &amp; Highlights
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "11px 22px" }}>
                  {pw.features.slice(0, 12).map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 15, color: "#334155", fontWeight: 500 }}>
                      <span style={{ color: accent, fontWeight: 800, marginTop: 2, flexShrink: 0 }}>✦</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photo grid */}
            {gridImgs.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {gridImgs.map((img, i) => (
                  <div key={i} style={{ aspectRatio: "4/3", overflow: "hidden", borderRadius: 12 }}>
                    <img src={img.url} alt={`Photo ${i + 2}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Agent card */}
            <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #EAEBEE" }}>
              <div style={{ background: primary, padding: "22px 20px", textAlign: "center" }}>
                {pw.agentPhoto ? (
                  <img src={pw.agentPhoto} alt={pw.agentName}
                    style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: `3px solid ${accent}`, margin: "0 auto 12px" }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 28, margin: "0 auto 12px" }}>
                    {(pw.agentName || "A")[0].toUpperCase()}
                  </div>
                )}
                <div className="display" style={{ color: "#fff", fontWeight: 600, fontSize: 21, lineHeight: 1.2 }}>
                  {pw.agentName || "Contact Agent"}
                </div>
                {pw.agentBrokerage && (
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12.5, marginTop: 5, fontWeight: 500 }}>
                    {pw.agentBrokerage}
                  </div>
                )}
              </div>
              <div style={{ padding: "16px 18px", background: "#fff" }}>
                {pw.agentLogoUrl && (
                  <div style={{ marginBottom: 13, paddingBottom: 12, borderBottom: "1px solid #EEF0F2", textAlign: "center" }}>
                    <img src={pw.agentLogoUrl} alt={pw.agentBrokerage || "Brokerage"} style={{ height: 28, maxWidth: "100%", objectFit: "contain" }} />
                  </div>
                )}
                {[
                  pw.agentPhone   && { label: pw.agentPhone },
                  pw.agentEmail   && { label: pw.agentEmail },
                  branding.website && { label: branding.website },
                ].filter(Boolean).map(({ label }, i) => (
                  <div key={i} style={{ fontSize: 13.5, color: "#475569", marginBottom: 8, wordBreak: "break-all", fontWeight: 500, textAlign: "center" }}>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* QR */}
            {qrUrl && (
              <div style={{ borderRadius: 16, padding: "18px", textAlign: "center", background: "#F8FAFC", border: "1px solid #EAEBEE" }}>
                <img src={qrUrl} alt="View listing online" style={{ width: 120, height: 120, display: "block", margin: "0 auto 10px" }} />
                <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.5, fontWeight: 600 }}>
                  Scan for photos &amp; virtual tour
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ borderTop: "1px solid #EAEBEE", padding: "16px 44px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400, maxWidth: 460 }}>
            All information deemed reliable but not guaranteed.
          </div>
          <div className="display" style={{ fontSize: 16, fontWeight: 600, color: primary }}>
            {branding.bizName}
          </div>
        </div>
      </div>
    </>
  );
}
