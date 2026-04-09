"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function GalleryDetailPage() {
  const { id } = useParams();
  const [gallery,   setGallery]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0); // 0-100
  const [msg,       setMsg]       = useState({ text: "", type: "" });
  const [showDeliver, setShowDeliver] = useState(false);
  const [delivering,  setDelivering]  = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailNote,    setEmailNote]   = useState("");
  const [activeTab, setActiveTab] = useState("images");
  const fileRef = useRef(null);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch(`/api/dashboard/galleries/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGallery(data.gallery);
        setEmailSubject(`Your listing media is ready | ${data.gallery.bookingAddress || ""}`);
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
    setMsg({ text: `${done} file${done !== 1 ? "s" : ""} uploaded successfully.`, type: "success" });
  }

  async function deliverGallery() {
    setDelivering(true);
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`/api/dashboard/galleries/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject: emailSubject, note: emailNote }),
    });
    setDelivering(false);
    setShowDeliver(false);
    if (res.ok) {
      setMsg({ text: "Gallery delivered to client.", type: "success" });
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
            className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-white text-xl">{gallery.bookingAddress || "Gallery"}</h1>
            <p className="text-white/60 text-xs mt-0.5">{allMedia.length} items uploaded</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              gallery.delivered ? "bg-green-500 text-white" :
              gallery.unlocked  ? "bg-blue-500 text-white"  :
              "bg-amber-400 text-white"
            }`}>
              {gallery.delivered ? "Delivered" : gallery.unlocked ? "Unlocked" : "Draft"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard/galleries" className="text-sm text-gray-400 hover:text-navy flex items-center gap-1">
            ← All galleries
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={toggleUnlock} className="btn-outline text-xs px-3 py-1.5">
              {gallery.unlocked ? "Lock gallery" : "Unlock gallery"}
            </button>
            <button
              onClick={() => setShowDeliver(true)}
              className="btn-primary text-sm px-5 py-2"
            >
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

        {/* Upload area */}
        <div
          className="border-2 border-dashed border-gray-200 rounded-sm p-6 mb-6 text-center cursor-pointer hover:border-navy/40 hover:bg-gray-50 transition-colors"
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
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
            <div>
              <p className="text-2xl mb-1">☁️</p>
              <p className="text-sm text-gray-500">Drop files here or <span className="text-navy font-medium">click to upload</span></p>
              <p className="text-xs text-gray-400 mt-1">Full-resolution photos and videos — agents download web or print quality</p>
            </div>
          )}
        </div>

        {/* Media tabs */}
        {allMedia.length > 0 && (
          <>
            <div className="flex gap-1 mb-4 border-b border-gray-200">
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

            {activeTab === "images" && (
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {images.map((m, i) => (
                  <div key={i} className="aspect-square rounded-sm overflow-hidden bg-gray-100 relative group">
                    <img src={m.url} alt={m.fileName || `Photo ${i + 1}`}
                      className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs text-center px-1 truncate">{m.fileName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "videos" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {videos.map((v, i) => (
                  <video key={i} src={v.url} controls className="w-full rounded-sm" />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Deliver modal */}
      {showDeliver && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-display text-navy text-lg">Deliver Gallery</h2>
              <button onClick={() => setShowDeliver(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Personal Note (optional)
                </label>
                <textarea
                  value={emailNote}
                  onChange={(e) => setEmailNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. Great shoot today! Let me know if you need anything adjusted."
                  className="input-field w-full resize-none"
                />
              </div>
              <div className="bg-gray-50 rounded-sm p-4 text-sm text-gray-600 space-y-2">
                <p className="font-medium text-gray-700">Email preview</p>
                <p>Hi {gallery.clientName || "there"},</p>
                {emailNote && <p className="italic">{emailNote}</p>}
                <p>Your media for <strong>{gallery.bookingAddress}</strong> is ready. You can view and download everything using the link below.</p>
                <p className="text-navy font-medium underline">[ View Gallery ]</p>
                <p className="text-gray-400 text-xs">— {gallery.tenantName || "Your photographer"}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowDeliver(false)} className="btn-outline px-4 py-2 text-sm">
                Cancel
              </button>
              <button onClick={deliverGallery} disabled={delivering} className="btn-primary px-6 py-2 text-sm">
                {delivering ? "Sending…" : "Deliver →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
