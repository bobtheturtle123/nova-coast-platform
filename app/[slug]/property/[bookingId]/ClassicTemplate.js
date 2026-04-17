"use client";

// ── Classic Template ──────────────────────────────────────────────────────────
// Clean, airy, traditional real estate feel. Contained hero, card-based body,
// white background with subtle borders. Familiar to agents and buyers.

export default function ClassicTemplate({
  pw, booking, images, videos, address, heroImg, stats, details,
  mapEmbedUrl, displayImages, showAllPhotos, setShowAllPhotos,
  setLightboxIdx, branding, theme, tenantSlug,
  ContactFormComponent,
}) {
  const statusColors = {
    "For Sale":    "bg-green-500 text-white",
    "Pending":     "bg-amber-500 text-white",
    "Sold":        "bg-red-500 text-white",
    "Coming Soon": "bg-blue-500 text-white",
  };

  return (
    <div className="min-h-screen bg-[#f9f8f6]" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* NAV */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logo ? (
              <img src={branding.logo} alt={branding.bizName} className="h-7 w-auto object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm rotate-45" style={{ background: theme.primary }} />
                <span className="font-bold text-base tracking-tight" style={{ color: theme.primary }}>
                  {branding.bizName}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {pw.status && (
              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColors[pw.status] || "bg-gray-600 text-white"}`}>
                {pw.status}
              </span>
            )}
            {pw.agentPhone && (
              <a href={`tel:${pw.agentPhone}`}
                className="hidden sm:flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ background: theme.primary }}>
                {pw.agentPhone}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* HERO — contained, not full-bleed */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="rounded-2xl overflow-hidden relative" style={{ height: 440 }}>
            {heroImg ? (
              <img src={heroImg} alt={address} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${theme.primary}, #334155)` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {pw.price && (
              <div className="absolute top-5 left-5">
                <div className="rounded-xl px-4 py-2.5 bg-white shadow-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Asking Price</p>
                  <p className="text-2xl font-bold leading-none mt-0.5" style={{ color: theme.primary }}>{pw.price}</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-5 left-5 right-5">
              <h1 className="text-white text-3xl font-bold leading-tight drop-shadow-md">{address}</h1>
              {stats.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {stats.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/30">
                      <span className="text-sm">{s.icon}</span>
                      <span className="text-white text-sm font-semibold">{s.value}</span>
                      <span className="text-white/70 text-xs">{s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* LEFT */}
          <div className="lg:col-span-2 space-y-8">

            {pw.description && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold mb-3" style={{ color: theme.primary }}>About This Property</h2>
                <p className="text-gray-600 leading-relaxed text-[15px] whitespace-pre-wrap">{pw.description}</p>
              </div>
            )}

            {/* Photo grid */}
            {images.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold" style={{ color: theme.primary }}>
                    Photos <span className="text-sm font-normal text-gray-400">({images.length})</span>
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-xl overflow-hidden">
                  {displayImages.map((img, i) => (
                    <div key={i}
                      className={`relative overflow-hidden cursor-pointer group bg-gray-100 ${i === 0 ? "col-span-2 row-span-2" : ""}`}
                      style={{ aspectRatio: "4/3" }}
                      onClick={() => setLightboxIdx(i)}>
                      <img src={img.url} alt={img.fileName || `Photo ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
                    </div>
                  ))}
                </div>
                {images.length > 9 && !showAllPhotos && (
                  <button onClick={() => setShowAllPhotos(true)}
                    className="mt-4 w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    Show all {images.length} photos
                  </button>
                )}
              </div>
            )}

            {/* Video */}
            {(videos.length > 0 || pw.videoUrl) && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold mb-4" style={{ color: theme.primary }}>Video Tour</h2>
                {pw.videoUrl ? (
                  <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
                    <iframe src={pw.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                      className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media" allowFullScreen />
                  </div>
                ) : videos.map((v, i) => (
                  <div key={i} className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
                    <video src={v.url} controls className="w-full h-full object-contain" />
                  </div>
                ))}
              </div>
            )}

            {/* Features */}
            {pw.features?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold mb-4" style={{ color: theme.primary }}>Features & Highlights</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pw.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: theme.accent }}>
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5l2 2L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Map */}
            {mapEmbedUrl && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold mb-4" style={{ color: theme.primary }}>Location</h2>
                <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: 300 }}>
                  <iframe src={mapEmbedUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" />
                </div>
                {pw.address && <p className="text-sm text-gray-500 mt-2">📍 {pw.address}</p>}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="space-y-5">

            {/* Details card */}
            {details.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4" style={{ background: theme.primary }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.accent }}>Property Details</p>
                  {pw.price && <p className="text-white text-2xl font-bold mt-1">{pw.price}</p>}
                </div>
                <div className="divide-y divide-gray-100">
                  {details.map((d) => (
                    <div key={d.label} className="px-5 py-3 flex justify-between">
                      <span className="text-sm text-gray-500">{d.label}</span>
                      <span className="text-sm font-semibold text-gray-800">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent */}
            {(pw.agentName || pw.agentPhone || pw.agentEmail) && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Listing Agent</p>
                <div className="flex items-center gap-3 mb-3">
                  {pw.agentPhoto ? (
                    <img src={pw.agentPhoto} alt={pw.agentName} className="w-11 h-11 rounded-full object-cover" />
                  ) : (
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ background: theme.primary }}>
                      {pw.agentName?.[0]?.toUpperCase() || "A"}
                    </div>
                  )}
                  <div>
                    {pw.agentName && <p className="font-semibold text-gray-900 text-sm">{pw.agentName}</p>}
                    {pw.agentBrokerage && <p className="text-xs text-gray-500">{pw.agentBrokerage}</p>}
                  </div>
                </div>
                {pw.agentLogoUrl && (
                  <div className="mb-3 pb-3 border-b border-gray-100">
                    <img src={pw.agentLogoUrl} alt="Brokerage" className="h-7 object-contain" />
                  </div>
                )}
                <div className="space-y-2">
                  {pw.agentPhone && (
                    <a href={`tel:${pw.agentPhone}`} className="flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: theme.primary }}>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                      {pw.agentPhone}
                    </a>
                  )}
                  {pw.agentEmail && (
                    <a href={`mailto:${pw.agentEmail}`} className="flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: theme.primary }}>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      {pw.agentEmail}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Contact form */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Request Information</p>
              <ContactFormComponent />
            </div>

            {branding.bizName && pw.branded !== false && (
              <p className="text-center text-xs text-gray-400">Photography by <span className="font-semibold" style={{ color: theme.primary }}>{branding.bizName}</span></p>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 py-5 px-6 bg-white mt-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          {pw.branded !== false && branding.bizName && <span>© {new Date().getFullYear()} {branding.bizName}</span>}
          <span className="sm:ml-auto">All information deemed reliable but not guaranteed.</span>
        </div>
      </footer>
    </div>
  );
}
