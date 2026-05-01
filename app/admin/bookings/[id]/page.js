"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { formatPrice, PACKAGES, SERVICES, ADDONS } from "@/lib/pricing";
import Link from "next/link";

const STATUSES = ["requested", "confirmed", "in_progress", "completed", "cancelled"];

const STATUS_COLORS = {
  requested:   "bg-amber-100 text-amber-700",
  confirmed:   "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed:   "bg-green-100 text-green-700",
  cancelled:   "bg-red-100 text-red-700",
};

export default function BookingDetailPage() {
  const { id }   = useParams();
  const router   = useRouter();
  const [booking,  setBooking]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [message,  setMessage]  = useState("");

  // Editable fields
  const [status,      setStatus]      = useState("");
  const [shootDate,   setShootDate]   = useState("");
  const [adminNotes,  setAdminNotes]  = useState("");

  useEffect(() => {
    getDoc(doc(db, "bookings", id))
      .then((snap) => {
        if (!snap.exists()) { router.push("/admin/bookings"); return; }
        const data = snap.data();
        setBooking(data);
        setStatus(data.status || "requested");
        setAdminNotes(data.adminNotes || "");
        if (data.shootDate?.seconds) {
          const d = new Date(data.shootDate.seconds * 1000);
          setShootDate(d.toISOString().slice(0, 16)); // datetime-local format
        }
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const updates = { status, adminNotes };
      if (shootDate) updates.shootDate = new Date(shootDate);

      await updateDoc(doc(db, "bookings", id), updates);
      setMessage("Saved ✓");
      setBooking((prev) => ({ ...prev, ...updates }));
    } catch (err) {
      setMessage("Error saving. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function sendConfirmEmail() {
    setSaving(true);
    try {
      await fetch("/api/admin/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: id }),
      });
      setMessage("Confirmation email sent ✓");
    } catch {
      setMessage("Failed to send email.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-gray-400 font-body flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
        Loading...
      </div>
    );
  }

  if (!booking) return null;

  const pkg      = PACKAGES.find((p) => p.id === booking.packageId);
  const services = SERVICES.filter((s) => booking.serviceIds?.includes(s.id));
  const addons   = ADDONS.filter((a) => booking.addonIds?.includes(a.id));

  return (
    <div className="p-8 max-w-4xl">
      {/* Back */}
      <Link href="/admin/bookings" className="text-sm text-gray-400 font-body hover:text-[#3486cf] mb-6 inline-block">
        ← All bookings
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-[#3486cf]">{booking.clientName}</h1>
          <p className="text-gray-500 font-body mt-1">{booking.fullAddress || booking.address}</p>
        </div>
        <span className={`text-xs px-3 py-1.5 rounded-full font-medium font-body ${STATUS_COLORS[booking.status] || "bg-gray-100"}`}>
          {booking.status?.replace("_", " ")}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-5">

          {/* Client info */}
          <div className="card">
            <p className="section-label mb-4">Client</p>
            <div className="grid grid-cols-2 gap-3 text-sm font-body">
              <div><p className="text-gray-400 text-xs mb-0.5">Name</p><p>{booking.clientName}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Email</p>
                <a href={`mailto:${booking.clientEmail}`} className="text-[#3486cf] underline">{booking.clientEmail}</a>
              </div>
              <div><p className="text-gray-400 text-xs mb-0.5">Phone</p>
                <a href={`tel:${booking.clientPhone}`}>{booking.clientPhone}</a>
              </div>
              <div><p className="text-gray-400 text-xs mb-0.5">Property Type</p><p className="capitalize">{booking.propertyType}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Sq Footage</p><p>{booking.squareFootage ? `${booking.squareFootage.toLocaleString()} sqft` : "—"}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Preferred Time</p><p className="capitalize">{booking.preferredTime || "—"}</p></div>
            </div>
            {booking.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-gray-400 text-xs mb-1">Client Notes</p>
                <p className="text-sm font-body text-[#0F172A]">{booking.notes}</p>
              </div>
            )}
          </div>

          {/* Services */}
          <div className="card">
            <p className="section-label mb-4">Services Booked</p>
            <div className="space-y-2 text-sm font-body">
              {pkg && (
                <div className="flex justify-between">
                  <span className="font-semibold">{pkg.name} Package</span>
                  <span>{formatPrice(pkg.price)}</span>
                </div>
              )}
              {services.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span>{s.name}</span>
                  <span>{formatPrice(s.price)}</span>
                </div>
              ))}
              {addons.map((a) => (
                <div key={a.id} className="flex justify-between text-gray-500">
                  <span>+ {a.name}</span>
                  <span>{formatPrice(a.price)}</span>
                </div>
              ))}
              {booking.travelFee > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>Travel fee</span>
                  <span>{formatPrice(booking.travelFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t border-gray-100">
                <span>Total</span>
                <span className="text-[#3486cf]">{formatPrice(booking.totalPrice || 0)}</span>
              </div>
            </div>
          </div>

          {/* Admin controls */}
          <div className="card space-y-4">
            <p className="section-label">Manage Booking</p>

            <div>
              <label className="block text-sm font-body font-medium mb-1.5">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field">
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-body font-medium mb-1.5">Confirmed Shoot Date & Time</label>
              <input
                type="datetime-local"
                value={shootDate}
                onChange={(e) => setShootDate(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-body font-medium mb-1.5">Internal Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="input-field resize-none"
                placeholder="Photographer assigned, access notes, etc."
              />
            </div>

            <div className="flex gap-3 items-center">
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={sendConfirmEmail} disabled={saving} className="btn-outline">
                Send Confirmation Email
              </button>
              {message && <p className="text-sm font-body text-green-600">{message}</p>}
            </div>
          </div>
        </div>

        {/* Right: Payment status */}
        <div className="space-y-4">
          <div className="card">
            <p className="section-label mb-4">Payment</p>
            <div className="space-y-3 text-sm font-body">
              <div className="flex justify-between">
                <span className="text-gray-500">Deposit</span>
                <span className={booking.depositPaid ? "text-green-600 font-semibold" : "text-gray-400"}>
                  {booking.depositPaid ? `✓ ${formatPrice(booking.depositAmount)}` : "Not paid"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Balance</span>
                <span className={booking.balancePaid ? "text-green-600 font-semibold" : "text-amber-600 font-medium"}>
                  {booking.balancePaid ? "✓ Paid" : formatPrice(booking.remainingBalance || 0)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-3">
                <span className="font-medium">Gallery</span>
                <span className={booking.galleryUnlocked ? "text-green-600" : "text-gray-400"}>
                  {booking.galleryUnlocked ? "Unlocked" : "Locked"}
                </span>
              </div>
            </div>
          </div>

          {booking.galleryId && (
            <div className="card">
              <p className="section-label mb-3">Gallery</p>
              <Link
                href={`/admin/gallery/${booking.galleryId}`}
                className="btn-outline text-sm text-center block"
              >
                Manage Gallery →
              </Link>
            </div>
          )}

          <div className="card">
            <p className="section-label mb-3">Booking Info</p>
            <div className="space-y-2 text-xs font-body text-gray-400">
              <div><span className="block">Booking ID</span>
                <span className="font-mono text-[#0F172A]">{id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div><span className="block">Created</span>
                <span className="text-[#0F172A]">
                  {booking.createdAt?.seconds
                    ? new Date(booking.createdAt.seconds * 1000).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
