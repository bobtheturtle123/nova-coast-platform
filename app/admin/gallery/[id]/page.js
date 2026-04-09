"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.novacoastmedia.com";

export default function AdminGalleryPage() {
  const { id: bookingId } = useParams();

  const [booking,  setBooking]  = useState(null);
  const [gallery,  setGallery]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [message,  setMessage]  = useState("");
  const [uploading, setUploading] = useState(false);

  // New media form state
  const [matterportUrl,   setMatterportUrl]   = useState("");
  const [matterportLabel, setMatterportLabel] = useState("3D Tour");

  useEffect(() => {
    async function load() {
      const bookingSnap = await getDoc(doc(db, "bookings", bookingId));
      if (!bookingSnap.exists()) return;
      const b = bookingSnap.data();
      setBooking(b);

      if (b.galleryId) {
        const gallerySnap = await getDoc(doc(db, "galleries", b.galleryId));
        if (gallerySnap.exists()) setGallery(gallerySnap.data());
      }
      setLoading(false);
    }
    load();
  }, [bookingId]);

  // Create gallery if it doesn't exist
  async function createGallery() {
    setSaving(true);
    try {
      const galleryId   = uuidv4();
      const accessToken = uuidv4();

      const galleryData = {
        id:              galleryId,
        bookingId,
        propertyAddress: booking.fullAddress || booking.address,
        createdAt:       new Date(),
        unlocked:        booking.balancePaid || false,
        accessToken,
        photos:          [],
        videos:          [],
        matterportLinks: [],
        floorPlans:      [],
        emailSentAt:     null,
      };

      await setDoc(doc(db, "galleries", galleryId), galleryData);
      await updateDoc(doc(db, "bookings", bookingId), { galleryId });

      setGallery(galleryData);
      setBooking((prev) => ({ ...prev, galleryId }));
      setMessage("Gallery created ✓");
    } catch (err) {
      setMessage("Error creating gallery.");
    } finally {
      setSaving(false);
    }
  }

  // Upload photos via pre-signed R2 URL
  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length || !gallery) return;

    setUploading(true);
    setMessage(`Uploading ${files.length} photo(s)...`);

    const uploaded = [];

    for (const file of files) {
      try {
        // Get pre-signed upload URL
        const res = await fetch("/api/gallery/upload-url", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            filename:    file.name,
            contentType: file.type,
            galleryId:   gallery.id,
          }),
        });
        const { uploadUrl, publicUrl } = await res.json();

        // Upload directly to R2
        await fetch(uploadUrl, {
          method:  "PUT",
          body:    file,
          headers: { "Content-Type": file.type },
        });

        uploaded.push({ url: publicUrl, filename: file.name });
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
      }
    }

    if (uploaded.length) {
      const newPhotos = [...(gallery.photos || []), ...uploaded];
      await updateDoc(doc(db, "galleries", gallery.id), { photos: newPhotos });
      setGallery((prev) => ({ ...prev, photos: newPhotos }));
      setMessage(`${uploaded.length} photo(s) uploaded ✓`);
    } else {
      setMessage("Upload failed. Check R2 config.");
    }

    setUploading(false);
  }

  // Add Matterport link
  async function addMatterportLink() {
    if (!matterportUrl || !gallery) return;
    const newLinks = [
      ...(gallery.matterportLinks || []),
      { url: matterportUrl, label: matterportLabel },
    ];
    await updateDoc(doc(db, "galleries", gallery.id), { matterportLinks: newLinks });
    setGallery((prev) => ({ ...prev, matterportLinks: newLinks }));
    setMatterportUrl("");
    setMessage("Matterport link added ✓");
  }

  // Send gallery email to client
  async function sendGalleryEmail() {
    setSaving(true);
    try {
      await fetch("/api/admin/send-gallery", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bookingId, galleryId: gallery.id }),
      });
      await updateDoc(doc(db, "galleries", gallery.id), { emailSentAt: new Date() });
      setGallery((prev) => ({ ...prev, emailSentAt: new Date() }));
      setMessage("Gallery email sent to client ✓");
    } catch (err) {
      setMessage("Failed to send email.");
    } finally {
      setSaving(false);
    }
  }

  const galleryUrl = gallery
    ? `${APP_URL}/gallery/${gallery.accessToken}`
    : null;

  if (loading) {
    return <div className="p-8 text-gray-400 font-body">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-3xl">
      <Link href={`/admin/bookings/${bookingId}`} className="text-sm text-gray-400 font-body hover:text-navy mb-4 inline-block">
        ← Back to booking
      </Link>
      <h1 className="font-display text-3xl text-navy mb-2">Gallery Manager</h1>
      <p className="text-gray-500 font-body mb-8">
        {booking?.fullAddress || booking?.address}
      </p>

      {message && (
        <div className="bg-green-50 border border-green-200 rounded-sm p-3 mb-6">
          <p className="text-green-700 text-sm font-body">{message}</p>
        </div>
      )}

      {/* Create gallery */}
      {!gallery ? (
        <div className="card">
          <p className="font-body text-charcoal mb-4">
            No gallery exists yet for this booking. Create one to start uploading media.
          </p>
          <button onClick={createGallery} disabled={saving} className="btn-primary">
            {saving ? "Creating..." : "Create Gallery"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Gallery link */}
          <div className="card">
            <p className="section-label mb-3">Gallery Link</p>
            <div className="flex gap-3 items-center">
              <input
                readOnly
                value={galleryUrl}
                className="input-field text-xs font-mono flex-1"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(galleryUrl); setMessage("Copied!"); }}
                className="btn-outline text-sm px-4 flex-shrink-0"
              >
                Copy
              </button>
              <a href={galleryUrl} target="_blank" rel="noreferrer"
                className="btn-outline text-sm px-4 flex-shrink-0">
                Preview
              </a>
            </div>
          </div>

          {/* Upload photos */}
          <div className="card">
            <p className="section-label mb-3">Photos</p>
            <p className="text-sm text-gray-500 font-body mb-4">
              {gallery.photos?.length || 0} photo(s) uploaded
            </p>
            <label className={`btn-outline cursor-pointer inline-block ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
              {uploading ? "Uploading..." : "Upload Photos"}
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </label>

            {/* Photo thumbnails */}
            {gallery.photos?.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                {gallery.photos.map((p, i) => (
                  <img
                    key={i}
                    src={p.url}
                    alt=""
                    className="w-full aspect-square object-cover rounded-sm"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Matterport */}
          <div className="card">
            <p className="section-label mb-3">Matterport / 3D Tour</p>
            <div className="flex gap-3">
              <input
                value={matterportLabel}
                onChange={(e) => setMatterportLabel(e.target.value)}
                placeholder="Label (e.g. Main Tour)"
                className="input-field w-32"
              />
              <input
                value={matterportUrl}
                onChange={(e) => setMatterportUrl(e.target.value)}
                placeholder="https://my.matterport.com/show/?m=..."
                className="input-field flex-1"
              />
              <button onClick={addMatterportLink} className="btn-outline flex-shrink-0">
                Add
              </button>
            </div>
            {gallery.matterportLinks?.map((l, i) => (
              <p key={i} className="text-xs font-mono text-gray-400 mt-2">{l.label}: {l.url}</p>
            ))}
          </div>

          {/* Send to client */}
          <div className="card">
            <p className="section-label mb-3">Delivery</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm text-charcoal">
                  Send gallery link to {booking?.clientEmail}
                </p>
                {gallery.emailSentAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last sent: {new Date(gallery.emailSentAt?.seconds * 1000 || gallery.emailSentAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={sendGalleryEmail}
                disabled={saving || !gallery.photos?.length}
                className="btn-primary"
              >
                {saving ? "Sending..." : "Send Gallery Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
