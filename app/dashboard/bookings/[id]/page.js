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
  const [cancelling,   setCancelling]   = useState(false);
  const [error,        setError]        = useState("");
  const [promoInput,   setPromoInput]   = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMsg,     setPromoMsg]     = useState(null); // { text, ok }

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

  async function applyPromo() {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoMsg(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}/apply-promo`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ code: promoInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setBooking((b) => ({ ...b, promoCode: data.code, promoDiscount: data.discount }));
        setPromoInput("");
        setPromoMsg({ text: `Code applied — $${data.discount.toFixed(2)} off`, ok: true });
      } else {
        setPromoMsg({ text: data.error || "Invalid code", ok: false });
      }
    } catch {
      setPromoMsg({ text: "Failed to apply code", ok: false });
    } finally {
      setPromoLoading(false);
    }
  }

  async function removePromo() {
    setPromoLoading(true);
    setPromoMsg(null);
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(`/api/dashboard/bookings/${id}/apply-promo`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setBooking((b) => ({ ...b, promoCode: null, promoDiscount: null }));
      setPromoMsg({ text: "Promo code removed", ok: true });
    } catch {
      setPromoMsg({ text: "Failed to remove code", ok: false });
    } finally {
      setPromoLoading(false);
    }
  }

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
    ? new Date(booking.shootDate.includes("T") ? booking.shootDate : booking.shootDate + "T12:00:00")
        .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : null;

  const shootTime12 = (() => {
    const t = booking.shootTime;
    if (!t) return null;
    const [hStr, mStr] = t.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  })();

  // Resolve service names from catalog
  const pkg      = catalog?.packages?.find(p => p.id === booking.packageId);
  const services = (booking.serviceIds  || []).map(sid => catalog?.services?.find(s => s.id === sid)?.name || sid).filter(Boolean);
  const addons   = (booking.addonIds    || []).map(aid => catalog?.addons?.find(a => a.id === aid)?.name   || aid).filter(Boolean);

  const payStatus = booking.paidInFull || booking.balancePaid
    ? { label: "Paid in Full",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    : booking.depositPaid
    ? { label: "Deposit Paid",  cls: "bg-blue-50 text-blue-700 border-blue-200" }
    : { label: "Unpaid",        cls: "bg-gray-50 text-gray-500 border-gray-200" };

  const wfStatus = resolveWorkflowStatus(booking);

  const hasPhotographer = booking.photographerName || booking.photographerEmail;
  const hasServices     = pkg || services.length > 0 || addons.length > 0;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">

      {/* Back */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/bookings" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          ← Bookings
        </Link>
        <Link href={`/dashboard/listings/${id}`} className="text-xs text-[#3486cf] hover:underline">
          Full listing details →
        </Link>
      </div>

      {/* Header card */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 leading-snug">{address}</h1>
            {(booking.city || booking.state) && (
              <p className="text-xs text-gray-400 mt-0.5">{[booking.city, booking.state].filter(Boolean).join(", ")}</p>
            )}
          </div>
          <WorkflowStatusBadge status={wfStatus} size="xs" />
        </div>

        {/* Shoot date/time — always prominent */}
        <div className={`flex items-center gap-3 mb-4 p-3 rounded-xl ${shootDate ? "bg-[#EEF5FC]" : "bg-gray-50"}`}>
          <svg className={`w-4 h-4 shrink-0 ${shootDate ? "text-[#3486cf]" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            {shootDate ? (
              <>
                <p className="text-sm font-semibold text-[#1E5A8A]">
                  {shootDate}
                  {shootTime12 && <span className="font-normal text-[#3486cf]"> · {shootTime12}</span>}
                </p>
                {booking.shootDuration && (
                  <p className="text-xs text-[#3486cf]/70">{booking.shootDuration} min</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 font-medium">No shoot date scheduled</p>
            )}
          </div>
        </div>

        {/* 4 info blocks — always visible */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-gray-50">

          {/* Client */}
          <InfoBlock label="Client">
            {(booking.clientName || booking.clientEmail || booking.clientPhone) ? (
              <>
                {booking.clientName  && <InfoRow v={booking.clientName} />}
                {booking.clientEmail && <InfoRow v={<a href={`mailto:${booking.clientEmail}`} className="text-[#3486cf] hover:underline">{booking.clientEmail}</a>} />}
                {booking.clientPhone && <InfoRow v={<a href={`tel:${booking.clientPhone}`} className="hover:underline">{booking.clientPhone}</a>} />}
              </>
            ) : (
              <p className="text-xs text-gray-300 italic">No client info</p>
            )}
          </InfoBlock>

          {/* Photographer */}
          <InfoBlock label="Photographer">
            {hasPhotographer ? (
              <>
                {booking.photographerName  && <InfoRow v={booking.photographerName} />}
                {booking.photographerPhone && <InfoRow v={<a href={`tel:${booking.photographerPhone}`} className="hover:underline">{booking.photographerPhone}</a>} />}
                {booking.photographerEmail && <InfoRow v={<a href={`mailto:${booking.photographerEmail}`} className="text-[#3486cf] hover:underline">{booking.photographerEmail}</a>} />}
              </>
            ) : (
              <Link href={`/dashboard/bookings/${id}/edit`} className="text-xs text-amber-600 hover:underline font-medium">
                Not assigned — assign →
              </Link>
            )}
          </InfoBlock>

          {/* Services */}
          <InfoBlock label="Services">
            {hasServices ? (
              <>
                {pkg && <InfoRow v={<span className="font-medium">{pkg.name}</span>} label="Pkg" />}
                {services.map((s, i) => <InfoRow key={i} v={s} />)}
                {addons.map((a, i)   => <InfoRow key={i} v={<span className="text-gray-400">+ {a}</span>} />)}
              </>
            ) : (
              <Link href={`/dashboard/bookings/${id}/edit`} className="text-xs text-gray-300 hover:underline italic">
                None selected — edit →
              </Link>
            )}
          </InfoBlock>

          {/* Payment */}
          <InfoBlock label="Payment">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${payStatus.cls}`}>
                {payStatus.label}
              </span>
            </div>
            {booking.totalPrice > 0     && <InfoRow label="Total"   v={`$${Number(booking.totalPrice).toLocaleString()}`} />}
            {booking.promoCode && booking.promoDiscount > 0 && (
              <InfoRow label="Promo" v={<span className="text-emerald-600">−${Number(booking.promoDiscount).toFixed(2)} ({booking.promoCode})</span>} />
            )}
            {booking.depositAmount > 0  && <InfoRow label="Deposit" v={`$${Number(booking.depositAmount).toLocaleString()} ${booking.depositPaid ? "✓" : "—"}`} />}
            {!booking.paidInFull && !booking.balancePaid && (booking.remainingBalance || 0) > 0 && (
              <InfoRow label="Balance" v={`$${Number(booking.remainingBalance).toLocaleString()} due`} />
            )}
          </InfoBlock>

        </div>

        {/* Property chips */}
        {(booking.propertyType || booking.squareFootage) && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-2">
            {booking.propertyType && (
              <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg">{booking.propertyType}</span>
            )}
            {booking.squareFootage && (
              <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg">
                {Number(String(booking.squareFootage).replace(/,/g, "")).toLocaleString()} sq ft
              </span>
            )}
          </div>
        )}

        {/* Notes */}
        {booking.notes && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-600 italic">&ldquo;{booking.notes}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link href={`/dashboard/bookings/${id}/edit`}
          className="flex-1 text-center text-sm font-medium py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:border-[#3486cf]/40 hover:text-[#3486cf] transition-colors">
          Edit Booking
        </Link>
        <Link href={`/dashboard/listings/${id}`}
          className="flex-1 text-center text-sm font-medium py-2.5 rounded-xl bg-[#3486cf] text-white hover:bg-[#2a72b8] transition-colors">
          Manage Listing
        </Link>
      </div>

      {/* Promo code */}
      <div className="card p-5">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-3 font-semibold">Promo Code</p>
        {booking.promoCode ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="font-mono text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg">
                {booking.promoCode}
              </span>
              {booking.promoDiscount > 0 && (
                <span className="ml-2 text-sm text-emerald-600 font-medium">
                  −${Number(booking.promoDiscount).toFixed(2)} off
                </span>
              )}
            </div>
            <button
              onClick={removePromo}
              disabled={promoLoading}
              className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter code"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && applyPromo()}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30 focus:border-[#3486cf] uppercase font-mono"
              maxLength={32}
            />
            <button
              onClick={applyPromo}
              disabled={promoLoading || !promoInput.trim()}
              className="text-sm font-medium px-4 py-2 rounded-xl bg-[#3486cf] text-white hover:bg-[#2a72b8] disabled:opacity-40 transition-colors"
            >
              {promoLoading ? "…" : "Apply"}
            </button>
          </div>
        )}
        {promoMsg && (
          <p className={`mt-2 text-xs ${promoMsg.ok ? "text-emerald-600" : "text-red-500"}`}>
            {promoMsg.text}
          </p>
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

function InfoBlock({ label, children }) {
  return (
    <div className="py-3">
      <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5 font-semibold">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, v }) {
  return (
    <div className="flex items-baseline gap-2 text-sm text-gray-700">
      {label && <span className="text-gray-400 text-xs w-12 shrink-0">{label}</span>}
      <span className="min-w-0 truncate">{v}</span>
    </div>
  );
}
