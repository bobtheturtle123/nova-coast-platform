"use client";

import { Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";

function ConfirmationContent() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const { bookingId, clientName, clientEmail, address, city, state, zip,
          preferredDate, pricing, packageId, serviceIds, addonIds, paidInFull, resetBooking } = useBookingStore();

  const bId = searchParams.get("bookingId") || bookingId;

  const formattedDate = preferredDate
    ? new Date(preferredDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : "To be confirmed";

  const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");
  const selectionCount = (packageId ? 1 : serviceIds?.length || 0) + (addonIds?.length || 0);

  return (
    <div className="step-container py-16">
      <div className="max-w-lg mx-auto">
        {/* Success icon */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-4xl text-[#3486cf] mb-3">Booking received.</h1>
          <p className="text-gray-500 max-w-sm">
            {clientEmail
              ? <>A confirmation has been sent to <span className="font-medium text-[#0F172A]">{clientEmail}</span>.</>
              : "You'll receive an email confirmation shortly."
            }
            {" "}We'll reach out within 24 hours to confirm your shoot.
          </p>
        </div>

        {/* Booking details card */}
        <div className="card space-y-3 mb-6">
          <p className="font-semibold text-[#0F172A] text-sm uppercase tracking-wider border-b border-gray-100 pb-3">
            Booking Details
          </p>

          {clientName && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Name</span>
              <span className="font-medium text-[#0F172A]">{clientName}</span>
            </div>
          )}
          {fullAddress && (
            <div className="flex justify-between text-sm gap-4">
              <span className="text-gray-400 flex-shrink-0">Property</span>
              <span className="font-medium text-[#0F172A] text-right">{fullAddress}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Requested date</span>
            <span className="font-medium text-[#0F172A]">{formattedDate}</span>
          </div>
          {bId && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Booking ID</span>
              <span className="font-mono text-xs text-gray-500">{bId.slice(0, 8).toUpperCase()}</span>
            </div>
          )}

          {/* Payment summary */}
          {pricing && (
            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              {paidInFull ? (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Paid in full</span>
                  <span className="font-semibold text-green-600">${pricing.subtotal?.toLocaleString()}</span>
                </div>
              ) : pricing.deposit > 0 ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Deposit paid</span>
                    <span className="font-semibold text-green-600">${pricing.deposit?.toLocaleString()}</span>
                  </div>
                  {pricing.balance > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Balance due at delivery</span>
                      <span className="font-medium text-[#0F172A]">${pricing.balance?.toLocaleString()}</span>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* What's next */}
        <div className="bg-[#3486cf]/4 rounded-xl p-5 mb-8 space-y-3">
          <p className="font-semibold text-[#3486cf] text-sm">What happens next?</p>
          <ol className="space-y-2 text-sm text-gray-600">
            {[
              "We'll review your booking and confirm availability.",
              "You'll receive a confirmation email with your scheduled shoot time.",
              "Your photographer will arrive and capture the property.",
              "Media will be delivered to your gallery link — balance due upon delivery.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-[#3486cf]/10 text-[#3486cf] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => { resetBooking(); router.push(`/${params.slug}/book`); }}
            className="btn-outline px-8 py-3 text-sm"
          >
            Book another shoot
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TenantConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
