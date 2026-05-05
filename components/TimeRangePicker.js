"use client";

export const TIME_RANGES = [
  { id: "7d",  label: "7D"  },
  { id: "30d", label: "30D" },
  { id: "3m",  label: "3M"  },
  { id: "6m",  label: "6M"  },
  { id: "12m", label: "12M" },
  { id: "all", label: "All" },
];

export default function TimeRangePicker({ value, onChange, ranges = TIME_RANGES, className = "" }) {
  return (
    <div
      className={`flex items-center rounded-lg overflow-hidden ${className}`}
      style={{ border: "1px solid #E9ECF0" }}
    >
      {ranges.map((r) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          className="px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
          style={
            value === r.id
              ? { background: "#3486cf", color: "#fff" }
              : { color: "#6B7280", background: "#fff" }
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
