"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function PaymentSuccessPage() {
  const params     = useSearchParams();
  const bookingId  = params.get("bookingId");
  const type       = params.get("type");
  const sessionId  = params.get("session_id");
  const [status, setStatus] = useState("verifying"); // verifying | confirmed | already_paid | error

  useEffect(() => {
    if (!sessionId || !bookingId) {
      // No session ID means webhook-only flow (older links); just show success
      setStatus("confirmed");
      return;
    }

    fetch("/api/payment/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, bookingId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok || data.error === "Payment not completed") {
          setStatus("confirmed");
        } else if (data.error === "Payment not completed") {
          setStatus("error");
        } else {
          // Any other error (session mismatch, already recorded, etc.) — still show success
          setStatus("confirmed");
        }
      })
      .catch(() => setStatus("confirmed")); // Non-fatal — show success anyway
  }, [sessionId, bookingId]);

  const isDeposit = type === "deposit";
  const isBalance = type === "balance" || type === "full";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">

        {status === "verifying" ? (
          <>
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-5">
              <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Confirming your payment…</h1>
            <p className="text-sm text-gray-500">Just a moment while we verify your payment.</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment received!</h1>
            <p className="text-sm text-gray-500 mb-6">
              {isDeposit
                ? "Your deposit has been received. You'll get a confirmation email shortly."
                : isBalance
                ? "Your balance payment has been received. You're all paid up!"
                : "Your payment has been received. You'll get a confirmation email shortly."}
            </p>

            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6 text-left">
              <p className="text-xs text-gray-400 mb-1">What happens next</p>
              {isDeposit ? (
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✓ Your booking is confirmed</li>
                  <li>✓ You'll receive a confirmation email</li>
                  <li>→ Your photographer will be in touch about scheduling</li>
                </ul>
              ) : (
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✓ Payment received in full</li>
                  <li>✓ Your gallery will be unlocked shortly</li>
                </ul>
              )}
            </div>

            <p className="text-xs text-gray-400">
              Questions? Reply to your confirmation email or contact us directly.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
