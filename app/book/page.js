"use client";

import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import { PACKAGES, SERVICES, formatPrice } from "@/lib/pricing";
import StepProgress from "@/components/booking/StepProgress";
import clsx from "clsx";

export default function BookPage() {
  const router = useRouter();
  const { packageId, serviceIds, setPackage, toggleService, hasSelections } =
    useBookingStore();

  function handleContinue() {
    if (!hasSelections()) return;
    router.push("/book/addons");
  }

  return (
    <>
      <StepProgress current={1} />

      <div className="step-container">
        {/* Heading */}
        <div className="mb-10">
          <p className="section-label mb-2">Step 1 of 6</p>
          <h1 className="font-display text-4xl text-[#3486cf] mb-3">
            Choose your package.
          </h1>
          <p className="font-body text-gray-500">
            Select a package below, or scroll down to build your own.
          </p>
        </div>

        {/* ── PACKAGES ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {PACKAGES.map((pkg) => {
            const selected = packageId === pkg.id;
            return (
              <button
                key={pkg.id}
                onClick={() => setPackage(pkg.id)}
                className={clsx(
                  "relative text-left p-6 border rounded-xl transition-all duration-200",
                  "focus:outline-none",
                  selected
                    ? "border-[#3486cf] bg-[#3486cf] text-white shadow-lg"
                    : "border-gray-200 bg-white hover:border-[#3486cf]/40 hover:shadow-sm"
                )}
              >
                {pkg.featured && (
                  <span
                    className={clsx(
                      "absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-body font-semibold",
                      "px-3 py-1 rounded-full tracking-wide",
                      selected
                        ? "bg-gold text-[#3486cf]"
                        : "bg-[#3486cf] text-gold"
                    )}
                  >
                    Most Popular
                  </span>
                )}

                <p
                  className={clsx(
                    "font-display text-2xl mb-1",
                    selected ? "text-white" : "text-[#3486cf]"
                  )}
                >
                  {pkg.name}
                </p>
                <p
                  className={clsx(
                    "font-display text-3xl mb-3",
                    selected ? "text-gold" : "text-[#3486cf]"
                  )}
                >
                  {formatPrice(pkg.price)}
                </p>
                <p
                  className={clsx(
                    "text-sm font-body mb-4 leading-relaxed",
                    selected ? "text-white/80" : "text-gray-500"
                  )}
                >
                  {pkg.tagline}
                </p>

                <ul className="space-y-1">
                  {pkg.services.map((s) => (
                    <li
                      key={s}
                      className={clsx(
                        "text-sm font-body flex items-center gap-2",
                        selected ? "text-white/90" : "text-[#0F172A]"
                      )}
                    >
                      <span className={selected ? "text-gold" : "text-gold"}>✓</span>
                      {s}
                    </li>
                  ))}
                </ul>

                <p
                  className={clsx(
                    "text-xs mt-4 font-body",
                    selected ? "text-white/60" : "text-gray-400"
                  )}
                >
                  {pkg.deliverables}
                </p>
              </button>
            );
          })}
        </div>

        {/* ── DIVIDER ── */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-body uppercase tracking-widest">
            Or build your own
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* ── À CARTE SERVICES ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
          {SERVICES.map((svc) => {
            const selected = serviceIds.includes(svc.id);
            return (
              <button
                key={svc.id}
                onClick={() => toggleService(svc.id)}
                className={clsx(
                  "text-left p-5 border rounded-xl transition-all duration-200",
                  "flex items-start justify-between gap-4 focus:outline-none",
                  selected
                    ? "border-[#3486cf] bg-[#3486cf]/5 shadow-sm"
                    : "border-gray-200 bg-white hover:border-[#3486cf]/30"
                )}
              >
                <div>
                  <p
                    className={clsx(
                      "font-body font-semibold mb-1",
                      selected ? "text-[#3486cf]" : "text-[#0F172A]"
                    )}
                  >
                    {svc.name}
                  </p>
                  <p className="text-sm text-gray-500 font-body">{svc.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={clsx("font-display text-xl", selected ? "text-[#3486cf]" : "text-[#0F172A]")}>
                    {formatPrice(svc.price)}
                  </p>
                  <div
                    className={clsx(
                      "mt-2 w-5 h-5 rounded border-2 flex items-center justify-center ml-auto",
                      selected ? "bg-[#3486cf] border-[#3486cf]" : "border-gray-300"
                    )}
                  >
                    {selected && <span className="text-white text-xs">✓</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── CTA ── */}
        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            disabled={!hasSelections()}
            className="btn-primary px-12"
          >
            Continue →
          </button>
        </div>
      </div>
    </>
  );
}
