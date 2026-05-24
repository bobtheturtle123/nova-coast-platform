"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function BookingDetailPage() {
  const { id }   = useParams();
  const router   = useRouter();

  const [booking,    setBooking]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error,      setError]      = useState("");

  const fetchBooking = useCallback(async (user) => {
    try {
      const token = await user.getIdToken();
      const res   = await fetch(`/api/dashboard/bookings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError("Booking not found."); return; }
      const data = await res.json();
      setBooking(data.booking);
    } catch { setError("Failed to load booking."); }
    finally   { setLoading(false); }
  }, [id]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) fetchBooking(user);
      else router.replace("/login");
    });
    return unsub;
  }, [fetchBooking, router]);

  async function cancelBooking() {
    if (!confirm("Cancel this booking? The client will not be notified automatically.")) return;
    setCancelling(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch(`/api/dashboard/bookings/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) setBooking((b) => ({ ...b, status: "cancelled" }));
    } finally { setCancelling(false); }
  }

  if (loading) return (
    <div className="p-8 flex justify-center h-64 items-center">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-8 text-center text-gray-500">{error}</div>
  );

  if (!booking) return null;

  const address   = booking.fullAddress || booking.address || "Property";
  const shootDate = booking.shootDate
    ? new Date(booking.shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : null;

  const statusColors = {
    confirmed:  "bg-green-50 text-green-700 border-green-200",
    pending:    "bg-amber-50 text-amber-700 border-amber-200",
    cancelled:  "bg-red-50 text-red-600 border-red-200",
    completed:  "bg-blue-50 text-blue-700 border-blue-200",
  };
  const statusClass = statusColors[booking.status] || "bg-gray-50 text-gray-500 border-gray-200";

  return (
    <div className="max-w-xl mx-auto p-6 space-y-5">

      {/* Back */}
      <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
        ← Dashboard
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900 leading-snug">{address}</h1>
            {shootDate && <p className="text-sm text-gray-500 mt-0.5">{shootDate}{booking.shootTime ? ` · ${booking.shootTime}` : ""}</p>}
          </div>
          <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-xl border capitalize ${statusClass}`}>
            {booking.status || "pending"}
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          {booking.clientName  && <div className="flex gap-3"><span className="text-gray-400 w-20 shrink-0">Client</span><span>{booking.clientName}</span></div>}
          {booking.clientEmail && <div className="flex gap-3"><span className="text-gray-400 w-20 shrink-0">Email</span><span className="break-all">{booking.clientEmail}</span></div>}
          {booking.clientPhone && <div className="flex gap-3"><span className="text-gray-400 w-20 shrink-0">Phone</span><span>{booking.clientPhone}</span></div>}
          {booking.photographerName && <div className="flex gap-3"><span className="text-gray-400 w-20 shrink-0">Photographer</span><span>{booking.photographerName}</span></div>}
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100">
          <Link
            href={`/dashboard/listings/${id}`}
            className="text-sm text-[#3486cf] hover:underline"
          >
            View full listing details →
          </Link>
        </div>
      </div>

      {/* Cancel */}
      {booking.status !== "cancelled" && (
        <div className="card p-5 border-red-100">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Cancel Booking</p>
          <p className="text-sm text-gray-500 mb-4">
            This will mark the booking as cancelled. The client will not be notified automatically.
          </p>
          <button
            disabled={cancelling}
            onClick={cancelBooking}
            className="text-sm px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {cancelling ? "Cancelling…" : "Cancel Booking"}
          </button>
        </div>
      )}

      {booking.status === "cancelled" && (
        <div className="card p-5 bg-red-50 border-red-200">
          <p className="text-sm font-medium text-red-700">This booking has been cancelled.</p>
        </div>
      )}

    </div>
  );
}
