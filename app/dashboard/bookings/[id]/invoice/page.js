"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { auth } from "@/lib/firebase";

function fmt(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr.length === 10 ? dateStr + "T12:00:00" : dateStr);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function fmtShort(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr.length === 10 ? dateStr + "T12:00:00" : dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function InvoicePage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [tenant,  setTenant]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const [bookingRes, tenantRes] = await Promise.all([
        fetch(`/api/dashboard/bookings/${id}`,   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/tenant",            { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (bookingRes.ok) {
        const d = await bookingRes.json();
        setBooking(d.booking);
      }
      if (tenantRes.ok) {
        const d = await tenantRes.json();
        setTenant(d.tenant);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
    </div>
  );

  if (!booking) return (
    <div className="p-8 text-gray-500">Booking not found.</div>
  );

  const primary     = tenant?.branding?.primaryColor || "#3486cf";
  const bizName     = tenant?.businessName || "Photography Studio";
  const bizEmail    = tenant?.email || "";
  const bizPhone    = tenant?.phone || "";
  const bizAddress  = tenant?.address || "";
  const logoUrl     = tenant?.branding?.logoUrl || null;

  const total         = booking.totalPrice       || 0;
  const depositAmt    = booking.depositAmount    || 0;
  const depositPaid   = !!booking.depositPaid;
  const balancePaid   = !!booking.balancePaid;
  const remaining     = booking.remainingBalance ?? (total - depositAmt);
  const paidInFull    = balancePaid || booking.paidInFull;

  const services = [
    booking.packageId && `Package: ${booking.packageId}`,
    ...(booking.serviceIds || []),
    ...(booking.addonIds   || []).map((a) => `Add-on: ${a}`),
  ].filter(Boolean);

  const invoiceNum = `INV-${id.slice(-6).toUpperCase()}`;
  const issuedDate = booking.createdAt ? fmtShort(booking.createdAt) : fmtShort(new Date().toISOString());

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0 print:py-0">
      {/* Print button — hidden when printing */}
      <div className="max-w-2xl mx-auto mb-4 flex justify-end gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Save as PDF
        </button>
        <button
          onClick={() => window.close()}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
        >
          Close
        </button>
      </div>

      {/* Invoice card */}
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-md print:shadow-none print:rounded-none print:max-w-none">
        {/* Header */}
        <div className="px-10 pt-10 pb-6" style={{ borderBottom: `3px solid ${primary}` }}>
          <div className="flex items-start justify-between">
            <div>
              {logoUrl ? (
                <img src={logoUrl} alt={bizName} className="h-10 mb-3 object-contain" />
              ) : (
                <p className="text-xl font-bold mb-1" style={{ color: primary }}>{bizName}</p>
              )}
              {bizEmail   && <p className="text-xs text-gray-500">{bizEmail}</p>}
              {bizPhone   && <p className="text-xs text-gray-500">{bizPhone}</p>}
              {bizAddress && <p className="text-xs text-gray-500">{bizAddress}</p>}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-900 tracking-tight">INVOICE</p>
              <p className="text-sm text-gray-400 mt-1">{invoiceNum}</p>
              <p className="text-xs text-gray-400 mt-0.5">Issued {issuedDate}</p>
            </div>
          </div>
        </div>

        {/* Bill to + shoot details */}
        <div className="px-10 py-6 grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">Bill To</p>
            <p className="font-semibold text-gray-900 text-sm">{booking.clientName || "—"}</p>
            {booking.clientEmail && <p className="text-sm text-gray-600">{booking.clientEmail}</p>}
            {booking.clientPhone && <p className="text-sm text-gray-600">{booking.clientPhone}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">Property</p>
            <p className="text-sm text-gray-700 font-medium">{booking.fullAddress || booking.address || "—"}</p>
            {(booking.shootDate || booking.preferredDate) && (
              <p className="text-sm text-gray-500 mt-1">
                {fmt(booking.shootDate || booking.preferredDate)}
              </p>
            )}
            {booking.preferredTime && (
              <p className="text-sm text-gray-500 capitalize">{booking.preferredTime}</p>
            )}
          </div>
        </div>

        {/* Services table */}
        <div className="px-10 pb-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-gray-400" style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th className="text-left py-2 font-semibold">Description</th>
                <th className="text-right py-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {services.length > 0 ? services.map((svc, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td className="py-2.5 text-gray-700">{svc}</td>
                  <td className="py-2.5 text-right text-gray-400">—</td>
                </tr>
              )) : (
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td className="py-2.5 text-gray-700">Photography services</td>
                  <td className="py-2.5 text-right text-gray-400">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-10 py-6">
          <div className="ml-auto max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-900">${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            {depositAmt > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Deposit{depositPaid ? " (paid)" : " (unpaid)"}</span>
                <span className={depositPaid ? "text-green-600" : "text-gray-400"}>
                  {depositPaid ? "–" : ""}${depositAmt.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2" style={{ borderTop: "2px solid #f3f4f6" }}>
              <span className="font-bold text-gray-900">Balance Due</span>
              <span className={`font-bold text-lg ${paidInFull ? "text-green-600" : "text-gray-900"}`}>
                {paidInFull ? "PAID" : `$${Math.max(0, remaining).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              </span>
            </div>
          </div>
        </div>

        {/* Offline payment note */}
        {booking.offlinePaymentMethod && (
          <div className="px-10 pb-6">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
              <p className="text-green-800 font-medium">
                Payment received: ${booking.offlinePaymentAmount} via {booking.offlinePaymentMethod}
                {booking.offlinePaymentNote && ` — ${booking.offlinePaymentNote}`}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-10 py-6 text-xs text-gray-400 text-center" style={{ borderTop: "1px solid #f3f4f6" }}>
          <p>Thank you for your business — {bizName}</p>
          <p className="mt-1 text-gray-300">Booking #{id}</p>
        </div>
      </div>

      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
