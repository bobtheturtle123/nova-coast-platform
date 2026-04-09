"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function GalleryDetailPage() {
  const { id }    = useParams();
  const [gallery,  setGallery]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg,      setMsg]      = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch(`/api/dashboard/galleries/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGallery(data.gallery);
      }
      setLoading(false);
    });
  }, [id]);

  async function uploadFiles(files) {
    setUploading(true);
    setMsg("");
    const token = await auth.currentUser.getIdToken();

    for (const file of files) {
      try {
        const { uploadUrl, publicUrl } = await fetch("/api/gallery/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileName: file.name, fileType: file.type, galleryId: id }),
        }).then((r) => r.json());

        await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

        await fetch(`/api/dashboard/galleries/${id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ publicUrl, fileName: file.name, fileType: file.type }),
        });

        setGallery((g) => ({
          ...g,
          media: [...(g.media || []), { url: publicUrl, name: file.name }],
        }));
      } catch {
        setMsg(`Failed to upload ${file.name}.`);
      }
    }
    setUploading(false);
    setMsg("Upload complete.");
  }

  async function sendGalleryEmail() {
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/galleries/${id}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setMsg("Gallery email sent to client.");
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

  return (
    <div className="p-8">
      <Link href="/dashboard/galleries" className="text-sm text-gray-400 hover:text-navy flex items-center gap-1 mb-6">
        ← Back to galleries
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy">{gallery.bookingAddress || "Gallery"}</h1>
          <p className="text-gray-400 text-sm">{gallery.media?.length || 0} items</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-3 py-1 rounded-full font-medium
            ${gallery.unlocked ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {gallery.unlocked ? "Unlocked" : "Locked"}
          </span>
          <button onClick={toggleUnlock} className="btn-outline text-xs px-3 py-1.5">
            {gallery.unlocked ? "Lock" : "Unlock"}
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2 rounded-sm mb-4">
          {msg}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="btn-primary px-4 py-2 text-sm">
          {uploading ? "Uploading…" : "Upload Media"}
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*"
          className="hidden"
          onChange={(e) => e.target.files?.length && uploadFiles(Array.from(e.target.files))} />
        <button onClick={sendGalleryEmail} className="btn-outline px-4 py-2 text-sm">
          Email Gallery to Client
        </button>
      </div>

      {/* Media grid */}
      {gallery.media?.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {gallery.media.map((m, i) => (
            <div key={i} className="aspect-square rounded-sm overflow-hidden bg-gray-100 relative group">
              {m.fileType?.startsWith("video/") ? (
                <video src={m.url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={m.url} alt={m.fileName || `Media ${i + 1}`}
                  className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-sm border-2 border-dashed border-gray-200 p-12 text-center text-gray-400 text-sm">
          <p className="text-2xl mb-2">📷</p>
          <p>No media uploaded yet. Click "Upload Media" to add photos and videos.</p>
        </div>
      )}
    </div>
  );
}
