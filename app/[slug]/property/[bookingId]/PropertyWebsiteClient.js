"use client";

import { useState, useRef, useEffect } from "react";

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft")  setIdx((i) => (i - 1 + images.length) % images.length);
      if (e.key === "Escape")     onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 right-5 text-white/60 hover:text-white text-3xl leading-none z-10">×</button>
      <button onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-4xl leading-none z-10 px-3">‹</button>
      <img src={images[idx]?.url} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" onClick={(e) => e.stopPropagation()} />
      <button onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-4xl leading-none z-10 px-3">›</button>
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-sm">{idx + 1} / {images.length}</p>
    </div>
  );
}

// ── Chat Widget ───────────────────────────────────────────────────────────────
function ChatWidget({ pw, address, branding, bookingId, tenantSlug }) {
  const [open,    setOpen]    = useState(false);
  const [msgs,    setMsgs]    = useState([
    { role: "assistant", content: `Hi! I can answer questions about ${address}. What would you like to know?` }
  ]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/${tenantSlug}/property-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, bookingId, pw }),
      });
      const data = await res.json();
      setMsgs((m) => [...m, { role: "assistant", content: data.reply || "Sorry, I couldn't answer that." }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally { setLoading(false); }
  }

  return (
    <>
      {/* Float button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105"
        style={{ background: branding.primary }}
      >
        {open ? (
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: 480 }}>
          <div className="px-4 py-3 flex items-center gap-3" style={{ background: branding.primary }}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">
              AI
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-none">Property Assistant</p>
              <p className="text-white/60 text-xs mt-0.5">Ask anything about this home</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 240 }}>
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] text-sm px-3 py-2 rounded-2xl leading-relaxed ${
                  m.role === "user"
                    ? "text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`} style={m.role === "user" ? { background: branding.primary } : {}}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1">
                  {[0,1,2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask a question…"
              className="flex-1 text-sm px-3 py-2 rounded-full border border-gray-200 outline-none focus:border-gray-400"
            />
            <button onClick={send} disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-opacity flex-shrink-0"
              style={{ background: branding.primary }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Contact Form ──────────────────────────────────────────────────────────────
function ContactForm({ pw, address, branding, bookingId, tenantSlug }) {
  const [form,     setForm]     = useState({ name: "", email: "", phone: "", message: "" });
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState("");

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/${tenantSlug}/property-inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, bookingId, address }),
      });
      if (res.ok) { setSent(true); }
      else { setError("Failed to send. Please try again."); }
    } catch { setError("Something went wrong."); }
    finally { setSending(false); }
  }

  if (sent) return (
    <div className="text-center py-8">
      <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="font-semibold text-gray-800 text-lg">Message Sent!</p>
      <p className="text-gray-500 text-sm mt-1">The listing agent will be in touch shortly.</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({...f, name: e.target.value}))}
          placeholder="Your name *" className="col-span-2 px-4 py-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors" />
        <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({...f, email: e.target.value}))}
          placeholder="Email *" className="px-4 py-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors" />
        <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({...f, phone: e.target.value}))}
          placeholder="Phone" className="px-4 py-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors" />
      </div>
      <textarea required rows={3} value={form.message} onChange={(e) => setForm((f) => ({...f, message: e.target.value}))}
        placeholder={`I'm interested in ${address}…`}
        className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors resize-none" />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button type="submit" disabled={sending}
        className="w-full py-3 rounded-lg text-white text-sm font-semibold transition-opacity disabled:opacity-60"
        style={{ background: branding.primary }}>
        {sending ? "Sending…" : "Send Inquiry"}
      </button>
    </form>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PropertyWebsiteClient({ pw, booking, galleryMedia, branding, bookingId, tenantSlug }) {
  const images    = galleryMedia.filter((m) => !m.fileType?.startsWith("video/"));
  const videos    = galleryMedia.filter((m) =>  m.fileType?.startsWith("video/"));
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  const address   = pw.customName || pw.address || booking.fullAddress || booking.address || "Property";
  const heroImg   = pw.heroImageUrl || images[0]?.url || null;
  const branded   = pw.branded !== false; // default branded

  const displayImages = showAllPhotos ? images : images.slice(0, 9);

  const statusColors = {
    "For Sale": { bg: "bg-green-500", text: "text-white" },
    "Pending":  { bg: "bg-amber-500", text: "text-white" },
    "Sold":     { bg: "bg-red-500",   text: "text-white" },
    "Coming Soon": { bg: "bg-blue-500", text: "text-white" },
  };
  const sc = statusColors[pw.status] || { bg: "bg-gray-700", text: "text-white" };

  const stats = [
    pw.beds     && { icon: "🛏", value: pw.beds,     label: "Beds" },
    pw.baths    && { icon: "🚿", value: pw.baths,    label: "Baths" },
    pw.sqft     && { icon: "📐", value: Number(String(pw.sqft).replace(/,/g,"")||0).toLocaleString(), label: "Sq Ft" },
    pw.parking  && { icon: "🚗", value: pw.parking,  label: "Parking" },
    pw.lotAcres && { icon: "🌿", value: pw.lotAcres, label: "Acres" },
  ].filter(Boolean);

  const details = [
    pw.price     && { label: "Asking Price",   value: pw.price },
    pw.type      && { label: "Property Type",  value: pw.type },
    pw.yearBuilt && { label: "Year Built",     value: pw.yearBuilt },
    pw.mlsNumber && { label: "MLS #",          value: pw.mlsNumber },
    pw.lotAcres  && { label: "Lot",            value: `${pw.lotAcres} acres` },
    pw.parking   && { label: "Parking",        value: pw.parking },
  ].filter(Boolean);

  // Google Maps embed URL (free iframe, no API key)
  const mapQuery = encodeURIComponent(pw.address || booking.fullAddress || booking.address || "");
  const mapEmbedUrl = mapQuery ? `https://maps.google.com/maps?q=${mapQuery}&output=embed&z=16` : null;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── NAV ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          {branded ? (
            <div className="flex items-center gap-3">
              {branding.logo ? (
                <img src={branding.logo} alt={branding.bizName} className="h-7 w-auto object-contain" />
              ) : (
                <span className="font-bold text-lg tracking-tight" style={{ color: branding.primary }}>
                  {branding.bizName}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: branding.primary }} />
              <span className="text-sm font-medium text-gray-500">Property Listing</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            {pw.status && (
              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${sc.bg} ${sc.text}`}>
                {pw.status}
              </span>
            )}
            {pw.agentPhone && (
              <a href={`tel:${pw.agentPhone}`}
                className="hidden sm:flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border transition-colors"
                style={{ borderColor: branding.primary, color: branding.primary }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
                {pw.agentPhone}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <div className="relative h-[60vh] sm:h-[70vh] bg-gray-900 overflow-hidden">
        {heroImg ? (
          <img src={heroImg} alt={address}
            className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-700" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />

        {/* Price badge */}
        {pw.price && (
          <div className="absolute top-6 left-6 sm:top-8 sm:left-8">
            <div className="rounded-xl px-5 py-3 backdrop-blur-md bg-black/40 border border-white/20">
              <p className="text-white/70 text-xs uppercase tracking-widest mb-0.5">Listing Price</p>
              <p className="text-white text-2xl font-bold leading-none">{pw.price}</p>
            </div>
          </div>
        )}

        {/* Address + stats */}
        <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-10 pb-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-white font-bold text-2xl sm:text-4xl md:text-5xl leading-tight mb-4 drop-shadow-lg">
              {address}
            </h1>
            {stats.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {stats.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                    <span className="text-base leading-none">{s.icon}</span>
                    <span className="text-white font-semibold text-sm">{s.value}</span>
                    <span className="text-white/60 text-xs">{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-10 lg:gap-16">

          {/* ── LEFT / MAIN ── */}
          <div className="lg:col-span-2 space-y-12">

            {/* Description */}
            {pw.description && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  About This Property
                </h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-[15px]">{pw.description}</p>
              </section>
            )}

            {/* Photo grid */}
            {images.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Photos <span className="text-base font-normal text-gray-400 ml-1">({images.length})</span>
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
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </div>
                  ))}
                </div>
                {images.length > 9 && !showAllPhotos && (
                  <button onClick={() => setShowAllPhotos(true)}
                    className="mt-4 w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    Show all {images.length} photos
                  </button>
                )}
              </section>
            )}

            {/* Video section */}
            {(videos.length > 0 || pw.videoUrl) && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Video Tour</h2>
                {pw.videoUrl ? (
                  <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
                    <iframe
                      src={pw.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : videos.map((v, i) => (
                  <div key={i} className="rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
                    <video src={v.url} controls className="w-full h-full object-contain" />
                  </div>
                ))}
              </section>
            )}

            {/* Features */}
            {pw.features?.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-5">Features & Highlights</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pw.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: branding.accent }}>
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      <span className="text-sm text-gray-700 leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Map */}
            {mapEmbedUrl && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Location</h2>
                <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 340 }}>
                  <iframe
                    src={mapEmbedUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                {pw.address && (
                  <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    {pw.address}
                  </p>
                )}
              </section>
            )}
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="space-y-6">

            {/* Property details card */}
            {details.length > 0 && (
              <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                <div className="px-5 py-4" style={{ background: branding.primary }}>
                  <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: branding.accent }}>
                    Property Details
                  </p>
                  {pw.price && <p className="text-white text-2xl font-bold">{pw.price}</p>}
                </div>
                <div className="divide-y divide-gray-100">
                  {details.map((d) => (
                    <div key={d.label} className="px-5 py-3 flex justify-between items-center">
                      <span className="text-sm text-gray-500">{d.label}</span>
                      <span className="text-sm font-semibold text-gray-800">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent card */}
            {(pw.agentName || pw.agentPhone || pw.agentEmail) && (
              <div className="rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-4 font-semibold">Listing Agent</p>
                <div className="flex items-center gap-3 mb-4">
                  {pw.agentPhoto ? (
                    <img src={pw.agentPhoto} alt={pw.agentName}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100" />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ring-2 ring-gray-100"
                      style={{ background: branding.primary }}>
                      {pw.agentName?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div>
                    {pw.agentName && <p className="font-semibold text-gray-900">{pw.agentName}</p>}
                    {pw.agentBrokerage && <p className="text-xs text-gray-500">{pw.agentBrokerage}</p>}
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  {pw.agentPhone && (
                    <a href={`tel:${pw.agentPhone}`}
                      className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
                      style={{ color: branding.primary }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                      </svg>
                      {pw.agentPhone}
                    </a>
                  )}
                  {pw.agentEmail && (
                    <a href={`mailto:${pw.agentEmail}`}
                      className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
                      style={{ color: branding.primary }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                      {pw.agentEmail}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Contact form */}
            <div className="rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-4 font-semibold">Request Information</p>
              <ContactForm pw={pw} address={address} branding={branding} bookingId={bookingId} tenantSlug={tenantSlug} />
            </div>

            {/* Photographer credit (branded only) */}
            {branded && branding.bizName && (
              <div className="text-center py-2">
                <p className="text-xs text-gray-400">
                  Photography by{" "}
                  <span className="font-semibold" style={{ color: branding.primary }}>{branding.bizName}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="mt-12 border-t border-gray-100 py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          {branded && <span>{branding.bizName && `© ${new Date().getFullYear()} ${branding.bizName}`}</span>}
          <span className="sm:ml-auto">All information deemed reliable but not guaranteed.</span>
        </div>
      </footer>

      {/* AI Chat Widget */}
      <ChatWidget pw={pw} address={address} branding={branding} bookingId={bookingId} tenantSlug={tenantSlug} />

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox images={images} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </div>
  );
}
