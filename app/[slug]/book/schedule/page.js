"use client";

import { useRouter, useParams } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";

export default function TenantSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const { preferredDate, preferredTime, setSchedule } = useBookingStore();

  function handleChange(e) {
    setSchedule({ [e.target.name]: e.target.value });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <>
      <StepProgress current={5} />
      <div className="step-container">
        <div className="mb-8">
          <p className="section-label mb-2">Step 5 of 6</p>
          <h1 className="font-display text-4xl text-navy mb-3">When works for you?</h1>
          <p className="font-body text-gray-500">We'll confirm availability within 24 hours and lock in an exact time.</p>
        </div>

        <div className="card max-w-lg space-y-6">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">
              Preferred Date <span className="text-red-400">*</span>
            </label>
            <input type="date" name="preferredDate" value={preferredDate} min={today}
              onChange={handleChange} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-3">Preferred Time</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "morning",   label: "Morning", desc: "8am – 12pm" },
                { value: "afternoon", label: "Afternoon", desc: "12pm – 5pm" },
              ].map((t) => (
                <button key={t.value} type="button"
                  onClick={() => setSchedule({ preferredTime: t.value })}
                  className={`p-4 border rounded-sm text-left transition-colors
                    ${preferredTime === t.value ? "border-navy bg-navy/5" : "border-gray-200 hover:border-navy/30"}`}>
                  <p className={`font-semibold text-sm ${preferredTime === t.value ? "text-navy" : "text-charcoal"}`}>
                    {t.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8">
          <button onClick={() => router.push(`/${params.slug}/book/review`)} className="btn-outline">← Back</button>
          <button onClick={() => router.push(`/${params.slug}/book/payment`)}
            disabled={!preferredDate} className="btn-primary px-12">Continue →</button>
        </div>
      </div>
    </>
  );
}
