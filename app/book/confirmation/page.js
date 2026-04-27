"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { useBookingStore } from "@/store/bookingStore";
import { formatPrice } from "@/lib/pricing";
import Link from "next/link";

function ConfirmationContent() {
  const params     = useSearchParams();
  const bookingId  = params.get("bookingId");
  const store      = useBookingStore();

  const {
    clientName, clientEmail, address, city, state,
    preferredDate, pricing, resetBooking,
  } = store;

  const formattedDate = preferredDate
    ? new Date(preferredDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : null;

  // Clear booking state after showing confirmation
  useEffect(() => {
    const timer = setTimeout(() => resetBooking(), 5 * 60 * 1000); // 5 min
    return () => clearTimeout(timer);
  }, [resetBooking]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center animate-fade-up">
        {/* Check icon */}
        <div className="w-16 h-16 bg-navy rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <p className="section-label mb-3">Booking Submitted</p>
        <h1 className="font-display text-4xl text-navy mb-4">
          You're all set, {clientName?.split(" ")[0] || "there"}.
        </h1>
        <p className="font-body text-gray-500 mb-8 leading-relaxed">
          Your booking request has been received. We'll review and confirm within
          24 hours — you'll get an email at{" "}
          <span className="font-medium text-charcoal">{clientEmail}</span>.
        </p>

        {/* Booking details card */}
        <div className="card text-left mb-8">
          <div className="space-y-3 text-sm font-body">
            {bookingId && (
              <div className="flex justify-between">
                <span className="text-gray-400">Booking ID</span>
                <span className="font-mono text-xs text-charcoal">{bookingId.slice(0, 8).toUpperCase()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Property</span>
              <span className="text-charcoal font-medium text-right max-w-[60%]">
                {[address, city, state].filter(Boolean).join(", ")}
              </span>
            </div>
            {formattedDate && (
              <div className="flex justify-between">
                <span className="text-gray-400">Requested Date</span>
                <span className="text-charcoal">{formattedDate}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-3">
              <span className="text-gray-400">Deposit Paid</span>
              <span className="text-navy font-semibold">
                {formatPrice(pricing?.deposit ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Due at Delivery</span>
              <span className="text-gray-500">{formatPrice(pricing?.balance ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-2 mb-8">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm font-body text-amber-700">Pending confirmation</span>
        </div>

        <div>
          <Link
            href="/"
            className="text-sm font-body text-navy underline underline-offset-4"
          >
            Back to KyoriaOS
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense>
      <ConfirmationContent />
    </Suspense>
  );
}
