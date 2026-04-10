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
  const pct = ((current - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pt-8 pb-4">
      {/* Mobile */}
      <div className="flex items-center justify-between sm:hidden mb-1">
        <span className="text-xs text-gray-400 font-body">
          Step {current} of {STEPS.length} — <span className="text-navy font-medium">{STEPS[current - 1]?.label}</span>
        </span>
        <span className="text-xs text-gray-300">{Math.round(pct)}%</span>
      </div>
      <div className="sm:hidden h-0.5 bg-gray-100 rounded-full">
        <div className="h-0.5 bg-navy rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-2.5 left-0 right-0 h-px bg-gray-150" style={{ backgroundColor: "#e8e4de" }} />
        {/* Progress line */}
        <div
          className="absolute top-2.5 left-0 h-px bg-navy transition-all duration-500"
          style={{ width: `${pct}%` }}
        />

        {STEPS.map((step) => {
          const done    = step.n < current;
          const active  = step.n === current;
          const pending = step.n > current;

          return (
            <div key={step.n} className="flex flex-col items-center z-10 gap-2">
              <div
                className={`
                  w-5 h-5 rounded-full flex items-center justify-center
                  transition-all duration-300
                  ${done    ? "bg-navy"                                               : ""}
                  ${active  ? "bg-navy ring-4 ring-navy/15"                           : ""}
                  ${pending ? "bg-white border border-gray-200"                       : ""}
                `}
              >
                {done ? (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span className={`text-[9px] font-semibold ${active ? "text-white" : "text-gray-300"}`}>
                    {step.n}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-body tracking-wider uppercase ${
                active ? "text-navy font-semibold" : done ? "text-gray-400" : "text-gray-300"
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
