"use client";

import { useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import Link from "next/link";

export default function TenantConfirmationPage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { bookingId, clientName, address, preferredDate, pricing, resetBooking } = useBookingStore();

  const bId = searchParams.get("bookingId") || bookingId;

  const date = preferredDate
    ? new Date(preferredDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "To be confirmed";

  return (
    <div className="step-container py-16 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
          ✓
        </div>
        <h1 className="font-display text-4xl text-navy mb-3">Booking received.</h1>
        <p className="text-gray-500 mb-8">
          You'll receive an email confirmation shortly. We'll reach out within 24 hours to confirm your shoot.
        </p>

        <div className="card text-left space-y-3 mb-8">
          {clientName && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Name</span>
              <span className="font-medium">{clientName}</span>
            </div>
          )}
          {address && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Property</span>
              <span className="font-medium text-right">{address}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Requested date</span>
            <span className="font-medium">{date}</span>
          </div>
          {pricing?.deposit && (
            <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
              <span className="text-gray-400">Deposit paid</span>
              <span className="font-semibold text-green-600">${pricing.deposit}</span>
            </div>
          )}
          {pricing?.balance && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Balance due at delivery</span>
              <span className="font-medium">${pricing.balance}</span>
            </div>
          )}
        </div>

        <button onClick={() => { resetBooking(); router.push(`/${params.slug}/book`); }}
          className="btn-outline px-8 py-3 text-sm">
          Book another shoot
        </button>
      </div>
    </div>
  );
}
