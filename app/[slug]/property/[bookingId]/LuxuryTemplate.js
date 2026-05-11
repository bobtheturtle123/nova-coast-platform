"use client";

// ── Luxury Template ───────────────────────────────────────────────────────────
// Editorial feel. Split hero (image left, details right on desktop).
// Bold oversized address, dark accent panels, lots of whitespace.
// Targets high-end residential and luxury estate listings.

export default function LuxuryTemplate({
  pw, booking, images, videos, address, heroImg, stats, details,
  mapEmbedUrl, displayImages, showAllPhotos, setShowAllPhotos,
  setLightboxIdx, branding, theme,
  ContactFormComponent, galleryMatterportUrl,
}) {
  const statusLabel = pw.status;
  const allPhotos = images;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* NAV — ultra-minimal */}
      <header className="fixed top-0 left-0 right-0 z-40 mix-blend-difference" style={{ pointerEvents: "none" }}>
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between" style={{ pointerEvents: "auto" }}>
          <div>
            {branding.logo ? (
              <img src={branding.logo} alt={branding.bizName} className="h-6 object-contain brightness-0 invert" />
            ) : (
              <span className="text-white font-bold text-sm tracking-widest uppercase">{branding.bizName}</span>
            )}
          </div>
          {pw.agentPhone && (
            <a href={`tel:${pw.agentPhone}`} className="text-white text-sm font-medium tracking-wide hover:opacity-70 transition-opacity">
              {pw.agentPhone}
            </a>
          )}
        </div>
      </header>

      {/* HERO — full height split */}
      <div className="relative flex flex-col lg:flex-row min-h-screen">
        {/* Image side */}
        <div className="lg:w-3/5 h-[60vh] lg:h-screen relative flex-shrink-0">
          {heroImg ? (
            <img src={heroImg} alt={address} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, #0d0d0d 100%)` }} />
          )}
          <div className="absolute inset-0 bg-black/20" />
          {statusLabel && (
            <div className="absolute top-8 left-8">
              <span className="text-white text-xs font-bold uppercase tracking-[0.3em] px-4 py-2 border border-white/40 backdrop-blur-sm">
                {statusLabel}
              </span>
            </div>
          )}
        </div>

        {/* Text side */}
        <div className="lg:w-2/5 flex items-center justify-center px-8 py-16 lg:py-24" style={{ background: theme.primary }}>
          <div className="w-full max-w-sm">
            {pw.price && (
              <p className="text-xs font-bold uppercase tracking-[0.4em] mb-4" style={{ color: theme.accent }}>{pw.price}</p>
            )}
            <h1 className="text-white text-3xl lg:text-4xl font-bold leading-tight mb-6">{address}</h1>
            {stats.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mb-8 pt-6 border-t border-white/10">
                {stats.slice(0, 3).map((s, i) => (
                  <div key={i} className="text-center">
                    <p className="text-white text-xl font-bold">{s.value}</p>
                    <p className="text-xs uppercase tracking-widest mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Scroll cue */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-px bg-white/30" />
              <span className="text-xs uppercase tracking-[0.3em] text-white/40">Scroll to explore</span>
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-20">

        {/* Description — full width editorial */}
        {pw.description && (
          <div className="max-w-3xl mb-20">
            <p className="text-xs font-bold uppercase tracking-[0.4em] mb-6" style={{ color: theme.accent }}>About This Property</p>
            <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap">{pw.description}</p>
          </div>
        )}

        {/* Stats row — horizontal if more */}
        {stats.length > 3 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-0 border border-gray-200 rounded-none mb-20">
            {stats.map((s, i) => (
              <div key={i} className={`text-center py-6 px-4 ${i < stats.length - 1 ? "border-r border-gray-200" : ""}`}>
                <p className="text-2xl font-bold" style={{ color: theme.primary }}>{s.value}</p>
                <p className="text-xs uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Photo grid — editorial masonry-ish */}
        {images.length > 0 && (
          <div className="mb-20">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.4em] mb-1" style={{ color: theme.accent }}>Gallery</p>
                <p className="text-2xl font-bold text-gray-900">{images.length} Photos</p>
              </div>
            </div>
            {/* First photo large, rest in grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {displayImages.map((img, i) => (
                <div key={i}
                  className={`relative overflow-hidden cursor-pointer group ${i === 0 ? "col-span-2 row-span-2" : ""}`}
                  style={{ aspectRatio: i === 0 ? "16/9" : "4/3" }}
                  onClick={() => setLightboxIdx(i)}>
                  <img src={img.url} alt={img.fileName || `Photo ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                </div>
              ))}
            </div>
            {images.length > 9 && !showAllPhotos && (
              <button onClick={() => setShowAllPhotos(true)}
                className="mt-6 px-8 py-3 text-sm font-bold uppercase tracking-widest border-2 transition-colors hover:text-white"
                style={{ borderColor: theme.primary, color: theme.primary }}
                onMouseEnter={e => { e.currentTarget.style.background = theme.primary; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                View All {images.length} Photos
              </button>
            )}
          </div>
        )}

        {/* Video */}
        {(videos.length > 0 || pw.videoUrl) && (
          <div className="mb-20">
            <p className="text-xs font-bold uppercase tracking-[0.4em] mb-6" style={{ color: theme.accent }}>Video Tour</p>
            {pw.videoUrl ? (
              <div className="relative rounded-none overflow-hidden" style={{ aspectRatio: "16/9" }}>
                <iframe src={pw.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                  className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media" allowFullScreen />
              </div>
            ) : videos.map((v, i) => (
              <div key={i} style={{ aspectRatio: "16/9" }}>
                <video src={v.url} controls className="w-full h-full object-contain bg-black" />
              </div>
            ))}
          </div>
        )}

        {/* 3D Tour */}
        {galleryMatterportUrl && (
          <div className="mb-20">
            <div className="flex items-center justify-between mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.4em]" style={{ color: theme.accent }}>3D Tour</p>
              <a href={galleryMatterportUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity"
                style={{ color: theme.accent }}>
                Fullscreen
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
            <div className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <iframe
                src={galleryMatterportUrl}
                className="w-full h-full absolute inset-0"
                allowFullScreen
                allow="xr-spatial-tracking"
                loading="lazy"
                title="3D Tour"
              />
            </div>
          </div>
        )}

        {/* Features */}
        {pw.features?.length > 0 && (
          <div className="mb-20">
            <p className="text-xs font-bold uppercase tracking-[0.4em] mb-6" style={{ color: theme.accent }}>Features & Highlights</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
              {pw.features.map((f, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-100">
                  <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: theme.accent }} />
                  <span className="text-sm text-gray-700">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Details + Agent + Contact — dark panel */}
        <div className="grid lg:grid-cols-3 gap-0 mb-20" style={{ background: theme.primary }}>
          {/* Details */}
          {details.length > 0 && (
            <div className="p-10 border-b lg:border-b-0 lg:border-r border-white/10">
              <p className="text-xs font-bold uppercase tracking-[0.4em] mb-6" style={{ color: theme.accent }}>Property Details</p>
              <div className="space-y-4">
                {details.map((d) => (
                  <div key={d.label} className="flex justify-between items-center border-b border-white/10 pb-4">
                    <span className="text-sm text-white/50">{d.label}</span>
                    <span className="text-sm font-bold text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent */}
          <div className="p-10 border-b lg:border-b-0 lg:border-r border-white/10">
            <p className="text-xs font-bold uppercase tracking-[0.4em] mb-6" style={{ color: theme.accent }}>Listing Agent</p>
            <div className="flex items-center gap-4 mb-6">
              {pw.agentPhoto ? (
                <img src={pw.agentPhoto} alt={pw.agentName} className="w-14 h-14 rounded-full object-cover border-2 border-white/20" />
              ) : (
                <div className="w-14 h-14 rounded-full border-2 border-white/20 flex items-center justify-center text-white font-bold text-xl">
                  {pw.agentName?.[0]?.toUpperCase() || "A"}
                </div>
              )}
              <div>
                {pw.agentName && <p className="text-white font-bold">{pw.agentName}</p>}
                {pw.agentBrokerage && <p className="text-sm text-white/50">{pw.agentBrokerage}</p>}
              </div>
            </div>
            {pw.agentLogoUrl && (
              <div className="mb-5 pb-5 border-b border-white/10">
                <img src={pw.agentLogoUrl} alt="Brokerage" className="h-8 object-contain brightness-0 invert opacity-70" />
              </div>
            )}
            <div className="space-y-3">
              {pw.agentPhone && (
                <a href={`tel:${pw.agentPhone}`} className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  {pw.agentPhone}
                </a>
              )}
              {pw.agentEmail && (
                <a href={`mailto:${pw.agentEmail}`} className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  {pw.agentEmail}
                </a>
              )}
            </div>
          </div>

          {/* Contact form — white on dark */}
          <div className="p-10">
            <p className="text-xs font-bold uppercase tracking-[0.4em] mb-6" style={{ color: theme.accent }}>Get In Touch</p>
            <div className="luxury-form">
              <style>{`
                .luxury-form input, .luxury-form textarea {
                  background: rgba(255,255,255,0.08) !important;
                  border-color: rgba(255,255,255,0.15) !important;
                  color: white !important;
                }
                .luxury-form input::placeholder, .luxury-form textarea::placeholder {
                  color: rgba(255,255,255,0.35) !important;
                }
                .luxury-form input:focus, .luxury-form textarea:focus {
                  border-color: rgba(255,255,255,0.5) !important;
                }
                .luxury-form label { color: rgba(255,255,255,0.6) !important; font-size: 11px !important; letter-spacing: 0.1em !important; }
              `}</style>
              <ContactFormComponent />
            </div>
          </div>
        </div>

        {/* Map */}
        {mapEmbedUrl && (
          <div className="mb-20">
            <p className="text-xs font-bold uppercase tracking-[0.4em] mb-6" style={{ color: theme.accent }}>Location</p>
            <div className="overflow-hidden" style={{ height: 320 }}>
              <iframe src={mapEmbedUrl} width="100%" height="100%" style={{ border: 0, filter: "grayscale(30%)" }} allowFullScreen loading="lazy" />
            </div>
            {pw.address && <p className="text-sm text-gray-500 mt-3">📍 {pw.address}</p>}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer style={{ background: theme.primary }}>
        <div className="max-w-7xl mx-auto px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          {pw.branded !== false && branding.bizName && (
            <span className="text-sm font-semibold text-white/80">{branding.bizName}</span>
          )}
          <span className="text-xs text-white/30 sm:ml-auto">All information deemed reliable but not guaranteed.</span>
        </div>
      </footer>
    </div>
  );
}
