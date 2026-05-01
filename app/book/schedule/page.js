"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";
import clsx from "clsx";

const TIME_PREFERENCES = [
  { value: "morning",   label: "Morning",   sub: "8am – 12pm" },
  { value: "afternoon", label: "Afternoon", sub: "12pm – 5pm"  },
  { value: "flexible",  label: "Flexible",  sub: "Any time works" },
];

// Get today + 2 days forward as min date (gives us time to prep)
function getMinDate() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().split("T")[0];
}

export default function SchedulePage() {
  const router = useRouter();
  const { preferredDate, preferredTime, setSchedule } = useBookingStore();

  const [date, setDate]   = useState(preferredDate || "");
  const [time, setTime]   = useState(preferredTime || "morning");
  const [error, setError] = useState("");

  function handleContinue() {
    if (!date) {
      setError("Please select a preferred date.");
      return;
    }
    setSchedule({ preferredDate: date, preferredTime: time });
    router.push("/book/payment");
  }

  return (
    <>
      <StepProgress current={5} />

      <div className="step-container max-w-xl">
        <div className="mb-8">
          <p className="section-label mb-2">Step 5 of 6</p>
          <h1 className="font-display text-4xl text-[#3486cf] mb-3">
            When works for you?
          </h1>
          <p className="font-body text-gray-500">
            Select your preferred date and time. We'll confirm availability and
            assign your photographer within 24 hours.
          </p>
        </div>

        {/* Date picker */}
        <div className="card mb-5">
          <label className="block text-sm font-body font-medium text-[#0F172A] mb-2">
            Preferred Date
          </label>
          <input
            type="date"
            value={date}
            min={getMinDate()}
            onChange={(e) => { setDate(e.target.value); setError(""); }}
            className="input-field"
          />
          {error && <p className="text-red-500 text-xs font-body mt-2">{error}</p>}
        </div>

        {/* Time preference */}
        <div className="card mb-8">
          <label className="block text-sm font-body font-medium text-[#0F172A] mb-3">
            Preferred Time of Day
          </label>
          <div className="grid grid-cols-3 gap-3">
            {TIME_PREFERENCES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTime(t.value)}
                className={clsx(
                  "p-4 border rounded-xl text-center transition-all duration-150 focus:outline-none",
                  time === t.value
                    ? "border-[#3486cf] bg-[#3486cf] text-white"
                    : "border-gray-200 hover:border-[#3486cf]/30"
                )}
              >
                <p className={clsx("font-body font-medium text-sm",
                  time === t.value ? "text-white" : "text-[#0F172A]")}>
                  {t.label}
                </p>
                <p className={clsx("text-xs mt-0.5",
                  time === t.value ? "text-white/70" : "text-gray-400")}>
                  {t.sub}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Phase 2 note */}
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 mb-8">
          <p className="text-sm font-body text-[#0F172A]">
            <span className="font-semibold text-[#3486cf]">How scheduling works:</span>{" "}
            After your deposit, we'll review your request and confirm your exact
            shoot time within 24 hours. You'll receive a confirmation email with
            your assigned photographer.
          </p>
        </div>

        <div className="flex justify-between">
          <button onClick={() => router.push("/book/review")} className="btn-outline">
            ← Back
          </button>
          <button onClick={handleContinue} className="btn-primary px-12">
            Continue →
          </button>
        </div>
      </div>
    </>
  );
}
