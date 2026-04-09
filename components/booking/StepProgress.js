"use client";

const STEPS = [
  { n: 1, label: "Services"  },
  { n: 2, label: "Add-ons"   },
  { n: 3, label: "Property"  },
  { n: 4, label: "Review"    },
  { n: 5, label: "Schedule"  },
  { n: 6, label: "Payment"   },
];

export default function StepProgress({ current }) {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 pt-8 pb-2">
      {/* Mobile: just show "Step X of 6" */}
      <p className="text-xs text-gray-400 font-body mb-4 sm:hidden">
        Step {current} of {STEPS.length}
      </p>

      {/* Desktop: full step bar */}
      <div className="hidden sm:flex items-center justify-between relative">
        {/* connecting line */}
        <div className="absolute top-3 left-0 right-0 h-px bg-gray-200" />
        <div
          className="absolute top-3 left-0 h-px bg-navy transition-all duration-500"
          style={{ width: `${((current - 1) / (STEPS.length - 1)) * 100}%` }}
        />

        {STEPS.map((step) => {
          const done    = step.n < current;
          const active  = step.n === current;
          const pending = step.n > current;

          return (
            <div key={step.n} className="flex flex-col items-center z-10">
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                  transition-all duration-300
                  ${done   ? "bg-navy text-white"              : ""}
                  ${active ? "bg-navy text-white ring-4 ring-navy/20" : ""}
                  ${pending? "bg-white border border-gray-300 text-gray-400" : ""}
                `}
              >
                {done ? "✓" : step.n}
              </div>
              <span
                className={`mt-2 text-xs font-body tracking-wide
                  ${active  ? "text-navy font-medium" : "text-gray-400"}`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
