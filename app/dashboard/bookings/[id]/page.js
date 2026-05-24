"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import { resolveWorkflowStatus } from "@/lib/workflowStatus";

export default function BookingDetailPage() {
  const { id }   = useParams();
  const router   = useRouter();

  const [booking,    setBooking]    = useState(null);
  const [catalog,    setCatalog]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error,      setError]      = useState("");

  const fetchAll = useCallback(async (user) => {
    try {
      const token = await user.getIdToken();
      const [bRes, cRes] = await Promise.all([
        fetch(`/api/dashboard/bookings/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/dashboard/catalog`,         { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!bRes.ok) { setError("Booking not found."); return; }
      const bData = await bRes.json();
      setBooking(bData.booking);
      if (cRes.ok) {
        const cData = await cRes.json();
        setCatalog(cData);
      }
    } catch { setError("Failed to load booking."); }
    finally   { setLoading(false); }
  }, [id]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) fetchAll(user);
      else router.replace("/login");
    });
    return unsub;
  }, [fetchAll, router]);

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

  if (error) return <div className="p-8 text-center text-gray-500">{error}</div>;
  if (!booking) return null;

  const address   = booking.fullAddress || booking.address || "Property";
  const shootDate = booking.shootDate
    ? new Date(booking.shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : null;

  // Resolve service names from catalog
  const pkg        = catalog?.packages?.find(p => p.id === booking.packageId);
  const services   = (booking.serviceIds  || []).map(sid => catalog?.services?.find(s => s.id === sid)?.name || sid).filter(Boolean);
  const addons     = (booking.addonIds    || []).map(aid => catalog?.addons?.find(a => a.id === aid)?.name   || aid).filter(Boolean);

  const payStatus = booking.paidInFull || booking.balancePaid
    ? { label: "Paid in Full", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    : booking.depositPaid
    ? { label: "Deposit Paid", cls: "bg-blue-50 text-blue-700 border-blue-200" }
    : { label: "Unpaid",       cls: "bg-gray-50 text-gray-500 border-gray-200" };

  const wfStatus = resolveWorkflowStatus(booking);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">

      {/* Back */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          ← Dashboard
        </Link>
        <Link href={`/dashboard/listings/${id}`} className="text-xs text-[#3486cf] hover:underline">
          Full listing details →
        </Link>
      </div>

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 leading-snug truncate">{address}</h1>
            {(booking.city || booking.state) && (
              <p className="text-xs text-gray-400 mt-0.5">{[booking.city, booking.state].filter(Boolean).join(", ")}</p>
            )}
          </div>
          <WorkflowStatusBadge status={wfStatus} size="xs" />
        </div>

        {/* Shoot date + time */}
        {(shootDate || booking.shootTime) && (
          <div className="flex items-center gap-2 mb-3 p-3 bg-[#EEF5FC] rounded-xl">
            <svg className="w-4 h-4 text-[#3486cf] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-[#1E5A8A]">
                {shootDate || "Date TBD"}
                {booking.shootTime && <span className="font-normal text-[#3486cf]"> · {booking.shootTime}</span>}
              </p>
              {booking.shootDuration && (
                <p className="text-xs text-[#3486cf]/70">{booking.shootDuration} min estimated</p>
              )}
            </div>
          </div>
        )}

        {/* Two-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 text-sm">

          {/* Client */}
          {(booking.clientName || booking.clientEmail || booking.clientPhone) && (
            <Section label="Client">
              {booking.clientName  && <Row v={booking.clientName} />}
              {booking.clientEmail && <Row v={<a href={`mailto:${booking.clientEmail}`} className="text-[#3486cf] hover:underline">{booking.clientEmail}</a>} />}
              {booking.clientPhone && <Row v={<a href={`tel:${booking.clientPhone}`} className="hover:underline">{booking.clientPhone}</a>} />}
            </Section>
          )}

          {/* Photographer */}
          {(booking.photographerName || booking.photographerEmail) && (
            <Section label="Photographer">
              {booking.photographerName  && <Row v={booking.photographerName} />}
              {booking.photographerPhone && <Row v={<a href={`tel:${booking.photographerPhone}`} className="hover:underline">{booking.photographerPhone}</a>} />}
              {booking.photographerEmail && <Row v={<a href={`mailto:${booking.photographerEmail}`} className="text-[#3486cf] hover:underline truncate">{booking.photographerEmail}</a>} />}
            </Section>
          )}

          {/* Services */}
          {(pkg || services.length > 0 || addons.length > 0) && (
            <Section label="Services">
              {pkg       && <Row v={<span className="font-medium">{pkg.name}</span>} />}
              {services.map((s, i) => <Row key={i} v={s} />)}
              {addons.map((a, i)   => <Row key={i} v={<span className="text-gray-400">+ {a}</span>} />)}
            </Section>
          )}

          {/* Payment */}
          <Section label="Payment">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${payStatus.cls}`}>
                {payStatus.label}
              </span>
            </div>
            {booking.totalPrice > 0 && <Row label="Total"   v={`$${booking.totalPrice.toLocaleString()}`} />}
            {booking.depositAmount > 0 && (
              <Row label="Deposit" v={`$${booking.depositAmount.toLocaleString()} ${booking.depositPaid ? "✓" : "—"}`} />
            )}
            {!booking.paidInFull && !booking.balancePaid && booking.remainingBalance > 0 && (
              <Row label="Balance" v={`$${booking.remainingBalance.toLocaleString()} due`} />
            )}
          </Section>

        </div>

        {/* Notes */}
        {booking.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-600 italic">&ldquo;{booking.notes}&rdquo;</p>
          </div>
        )}

        {/* Property */}
        {(booking.propertyType || booking.squareFootage) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {booking.propertyType && (
              <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg">{booking.propertyType}</span>
            )}
            {booking.squareFootage && (
              <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg">{Number(String(booking.squareFootage).replace(/,/g,'')).toLocaleString()} sq ft</span>
            )}
          </div>
        )}
      </div>

      {/* Cancel */}
      {booking.status !== "cancelled" && (
        <div className="card p-5 border-red-100">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Cancel Booking</p>
          <p className="text-xs text-gray-400 mb-3">The client will not be notified automatically.</p>
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
        <div className="rounded-xl p-4 bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-700">This booking has been cancelled.</p>
        </div>
      )}

    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, v }) {
  return (
    <div className="flex items-baseline gap-2 text-sm text-gray-700">
      {label && <span className="text-gray-400 text-xs w-14 shrink-0">{label}</span>}
      <span className="min-w-0">{v}</span>
    </div>
  );
}
