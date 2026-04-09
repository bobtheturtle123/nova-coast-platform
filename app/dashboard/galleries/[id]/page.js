"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";

// ─── Tiny image with loading + error states ───────────────────────────────────
function MediaThumb({ src, alt, isFirst, isDragging, onDragStart, onDragOver, onDrop, onDragEnd, index }) {
  const [loaded,  setLoaded]  = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`
        aspect-square rounded-sm overflow-hidden bg-gray-100 relative group cursor-grab active:cursor-grabbing
        ${isDragging ? "opacity-40 scale-95" : ""}
        transition-all duration-150
      `}
    >
      {/* Loading skeleton */}
      {!loaded && !errored && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}

      {/* Error state */}
      {errored && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-400">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs mt-1">Not loaded</span>
        </div>
      )}

      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        crossOrigin="anonymous"
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 pointer-events-none">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="text-white text-xs">Drag to reorder</span>
      </div>

      {/* Cover badge */}
      {isFirst && (
        <div className="absolute top-1.5 left-1.5">
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-sm bg-navy text-white">Cover</span>
        </div>
      )}

      {/* Position number */}
      <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white text-xs flex items-center justify-center font-bold">
        {index + 1}
      </div>
    </div>
  );
}

// ─── Email tag input ──────────────────────────────────────────────────────────
function EmailTagInput({ label, value, onChange, placeholder }) {
  const [input, setInput] = useState("");

  function addEmail(raw) {
    const emails = raw.split(/[,;\s]+/).map((e) => e.trim()).filter((e) => e.includes("@"));
    if (emails.length) onChange([...value, ...emails]);
    setInput("");
  }

  function removeEmail(i) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="input-field min-h-10 flex flex-wrap gap-1.5 p-2 cursor-text"
        onClick={(e) => e.currentTarget.querySelector("input")?.focus()}>
        {value.map((email, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-navy/10 text-navy text-xs px-2 py-0.5 rounded-sm">
            {email}
            <button onClick={() => removeEmail(i)} className="hover:text-red-500 leading-none text-base">&times;</button>
          </span>
        ))}
        <input
          type="email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (["Enter", "Tab", ",", ";"].includes(e.key)) {
              e.preventDefault();
              if (input.trim()) addEmail(input);
            }
            if (e.key === "Backspace" && !input && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => { if (input.trim()) addEmail(input); }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add multiple</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function GalleryDetailPage() {
  const { id } = useParams();
  const [gallery,      setGallery]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [msg,          setMsg]          = useState({ text: "", type: "" });
  const [showDeliver,  setShowDeliver]  = useState(false);
  const [delivering,   setDelivering]   = useState(false);
  const [activeTab,    setActiveTab]    = useState("images");
  const [dragIdx,      setDragIdx]      = useState(null);
  const [savingOrder,  setSavingOrder]  = useState(false);
  const fileRef = useRef(null);

  // Email state
  const [emailSubject,  setEmailSubject]  = useState("");
  const [emailTo,       setEmailTo]       = useState([]);
  const [emailCc,       setEmailCc]       = useState([]);
  const [emailNote,     setEmailNote]     = useState("");

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch(`/api/dashboard/galleries/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGallery(data.gallery);
        setEmailSubject(`Your listing media is ready — ${data.gallery.bookingAddress || ""}`);
        if (data.gallery.clientEmail) setEmailTo([data.gallery.clientEmail]);
      }
      setLoading(false);
    });
  }, [id]);

  async function uploadFiles(files) {
    setUploading(true);
    setProgress(0);
    setMsg({ text: "", type: "" });
    const token = await auth.currentUser.getIdToken();
    const total = files.length;
    let done = 0;

    for (const file of files) {
      try {
        const { uploadUrl, publicUrl, key } = await fetch("/api/gallery/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileName: file.name, fileType: file.type, galleryId: id }),
        }).then((r) => r.json());

        await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

        await fetch(`/api/dashboard/galleries/${id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ publicUrl, key, fileName: file.name, fileType: file.type }),
        });

        done++;
        setProgress(Math.round((done / total) * 100));
        setGallery((g) => ({
          ...g,
          media: [...(g.media || []), { url: publicUrl, key, fileName: file.name, fileType: file.type }],
        }));
      } catch {
        setMsg({ text: `Failed to upload ${file.name}.`, type: "error" });
      }
    }
    setUploading(false);
    setMsg({ text: `${done} file${done !== 1 ? "s" : ""} uploaded.`, type: "success" });
  }

  // ─── Drag-to-reorder ───────────────────────────────────────────────────────
  const handleDragStart = useCallback((e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(async (e, toIdx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); return; }

    setGallery((g) => {
      const isImages = activeTab === "images";
      const allMedia  = g.media || [];
      const images    = allMedia.filter((m) => !m.fileType?.startsWith("video/"));
      const videos    = allMedia.filter((m) =>  m.fileType?.startsWith("video/"));
      const list      = isImages ? [...images] : [...videos];

      const [moved] = list.splice(dragIdx, 1);
      list.splice(toIdx, 0, moved);

      const newMedia = isImages ? [...list, ...videos] : [...images, ...list];
      return { ...g, media: newMedia };
    });

    setDragIdx(null);
  }, [dragIdx, activeTab]);

  const handleDragEnd = useCallback(() => setDragIdx(null), []);

  async function saveOrder() {
    setSavingOrder(true);
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/galleries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ media: gallery.media }),
    });
    setSavingOrder(false);
    setMsg({ text: "Order saved.", type: "success" });
  }

  // ─── Deliver ──────────────────────────────────────────────────────────────
  async function deliverGallery() {
    if (emailTo.length === 0) {
      setMsg({ text: "Add at least one recipient email.", type: "error" });
      setShowDeliver(false);
      return;
    }
    setDelivering(true);
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`/api/dashboard/galleries/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject: emailSubject, note: emailNote, to: emailTo, cc: emailCc }),
    });
    setDelivering(false);
    setShowDeliver(false);
    if (res.ok) {
      setMsg({ text: "Gallery delivered.", type: "success" });
      setGallery((g) => ({ ...g, delivered: true }));
    } else {
      setMsg({ text: "Failed to send email.", type: "error" });
    }
  }

  async function toggleUnlock() {
    const token = await auth.currentUser.getIdToken();
    const newVal = !gallery.unlocked;
    await fetch(`/api/dashboard/galleries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ unlocked: newVal }),
    });
    setGallery((g) => ({ ...g, unlocked: newVal }));
  }

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );
  if (!gallery) return <div className="p-8 text-gray-500">Gallery not found.</div>;

  const allMedia = gallery.media || [];
  const images   = allMedia.filter((m) => !m.fileType?.startsWith("video/"));
  const videos   = allMedia.filter((m) =>  m.fileType?.startsWith("video/"));
  const coverImg = images[0]?.url || null;

  return (
    <div>
      {/* Hero */}
      <div className="relative h-44 bg-gray-900 overflow-hidden">
        {coverImg && (
          <img src={coverImg} alt={gallery.bookingAddress}
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            crossOrigin="anonymous" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-white text-xl">{gallery.bookingAddress || "Gallery"}</h1>
            <p className="text-white/60 text-xs mt-0.5">{allMedia.length} items</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            gallery.delivered ? "bg-green-500 text-white" :
            gallery.unlocked  ? "bg-blue-500 text-white" :
            "bg-amber-400 text-white"
          }`}>
            {gallery.delivered ? "Delivered" : gallery.unlocked ? "Unlocked" : "Draft"}
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/dashboard/galleries" className="text-sm text-gray-400 hover:text-navy flex items-center gap-1">
            ← All galleries
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={toggleUnlock} className="btn-outline text-xs px-3 py-1.5">
              {gallery.unlocked ? "Lock gallery" : "Unlock gallery"}
            </button>
            <button onClick={() => setShowDeliver(true)} className="btn-primary text-sm px-5 py-2">
              Deliver to Client
            </button>
          </div>
        </div>

        {msg.text && (
          <div className={`text-sm px-4 py-2.5 rounded-sm mb-4 ${
            msg.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {msg.text}
          </div>
        )}

        {/* Upload zone */}
        <div
          className="border-2 border-dashed border-gray-200 rounded-sm p-6 mb-6 text-center cursor-pointer hover:border-navy/40 hover:bg-gray-50 transition-colors"
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files).filter(
              (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
            );
            if (files.length) uploadFiles(files);
          }}
        >
          <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
            onChange={(e) => e.target.files?.length && uploadFiles(Array.from(e.target.files))} />
          {uploading ? (
            <div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2 max-w-xs mx-auto">
                <div className="bg-navy h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-gray-500">Uploading… {progress}%</p>
            </div>
          ) : (
            <>
              <p className="text-2xl mb-1">☁️</p>
              <p className="text-sm text-gray-500">Drop files here or <span className="text-navy font-medium">click to upload</span></p>
              <p className="text-xs text-gray-400 mt-1">Full-res photos and videos — agents download in Web or Print quality</p>
            </>
          )}
        </div>

        {/* Media tabs + reorder hint */}
        {allMedia.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1 border-b border-gray-200">
                {[
                  { id: "images", label: `Images (${images.length})` },
                  ...(videos.length > 0 ? [{ id: "videos", label: `Videos (${videos.length})` }] : []),
                ].map((t) => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === t.id
                        ? "border-navy text-navy"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">Drag to reorder · first photo is the cover</p>
                <button
                  onClick={saveOrder}
                  disabled={savingOrder}
                  className="text-xs btn-outline px-3 py-1"
                >
                  {savingOrder ? "Saving…" : "Save Order"}
                </button>
              </div>
            </div>

            {activeTab === "images" && (
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {images.map((m, i) => (
                  <MediaThumb
                    key={m.key || i}
                    src={m.url}
                    alt={m.fileName || `Photo ${i + 1}`}
                    isFirst={i === 0}
                    index={i}
                    isDragging={dragIdx === i}
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={(e) => handleDrop(e, i)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            )}

            {activeTab === "videos" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {videos.map((v, i) => (
                  <div key={v.key || i} className="space-y-1">
                    <video src={v.url} controls className="w-full rounded-sm" />
                    <p className="text-xs text-gray-400 truncate">{v.fileName}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Deliver modal */}
      {showDeliver && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-display text-navy text-lg">Deliver Gallery</h2>
              <button onClick={() => setShowDeliver(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4">
              {/* To field */}
              <EmailTagInput
                label="To"
                value={emailTo}
                onChange={setEmailTo}
                placeholder={gallery.clientEmail || "client@example.com"}
              />

              {/* CC field */}
              <EmailTagInput
                label="CC (optional)"
                value={emailCc}
                onChange={setEmailCc}
                placeholder="Add CC recipients…"
              />

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Email Subject
                </label>
                <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                  className="input-field w-full" />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Personal Note (optional)
                </label>
                <textarea
                  value={emailNote}
                  onChange={(e) => setEmailNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. Great shoot today! Let me know if anything needs adjusting."
                  className="input-field w-full resize-none"
                />
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-sm p-4 text-sm text-gray-600 space-y-2">
                <p className="font-medium text-gray-700 text-xs uppercase tracking-wide">Email preview</p>
                <p>Hi {gallery.clientName || "there"},</p>
                {emailNote && <p className="italic">{emailNote}</p>}
                <p>Your media for <strong>{gallery.bookingAddress}</strong> is ready.</p>
                <p className="text-navy font-medium underline">[ View Gallery ]</p>
                <p className="text-gray-400 text-xs">— {gallery.tenantName || "Your photographer"}</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowDeliver(false)} className="btn-outline px-4 py-2 text-sm">Cancel</button>
              <button onClick={deliverGallery} disabled={delivering || emailTo.length === 0}
                className="btn-primary px-6 py-2 text-sm">
                {delivering ? "Sending…" : `Deliver to ${emailTo.length + emailCc.length} recipient${emailTo.length + emailCc.length !== 1 ? "s" : ""} →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
