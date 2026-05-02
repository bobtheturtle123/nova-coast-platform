"use client";

import { PIPELINE_ORDER, OVERRIDE_STATUSES, getStatus } from "@/lib/workflowStatus";

export default function WorkflowStepper({
  currentStatus,
  onStatusChange,
  history = [],
  updating = false,
}) {
  const activeIdx  = PIPELINE_ORDER.indexOf(currentStatus);
  const isOverride = OVERRIDE_STATUSES.includes(currentStatus);

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">Workflow Pipeline</p>
        {updating && (
          <div className="w-3.5 h-3.5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
        )}
      </div>

      {/* Main pipeline — horizontally scrollable on mobile */}
      <div className="flex items-start overflow-x-auto pb-3 -mx-1 px-1">
        {PIPELINE_ORDER.map((id, idx) => {
          const s        = getStatus(id);
          const isActive = id === currentStatus;
          const isPast   = !isOverride && idx < activeIdx;
          const isLast   = idx === PIPELINE_ORDER.length - 1;

          return (
            <div key={id} className="flex items-center flex-shrink-0">
              <button
                type="button"
                disabled={updating}
                onClick={() => onStatusChange(id)}
                className={`flex flex-col items-center gap-1.5 px-1 group transition-opacity ${
                  updating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                {/* Step circle */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                  isActive
                    ? "bg-[#3486cf] border-[#3486cf] shadow-sm shadow-[#3486cf]/20"
                    : isPast
                    ? "bg-[#EEF5FC] border-[#3486cf]/40 group-hover:border-[#3486cf]/70"
                    : "bg-white border-gray-200 group-hover:border-gray-300"
                }`}>
                  {isPast ? (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1.5" stroke="#3486cf" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : isActive ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-200 group-hover:bg-gray-300 transition-colors" />
                  )}
                </div>

                {/* Step label */}
                <p className={`text-[10px] text-center leading-tight w-16 transition-colors ${
                  isActive ? "text-[#3486cf] font-semibold"
                  : isPast  ? "text-[#3486cf]/70 font-medium"
                  : "text-gray-400 group-hover:text-gray-500"
                }`}>
                  {s?.label}
                </p>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div className={`h-px w-5 flex-shrink-0 -mt-4 ${
                  isPast && !isOverride ? "bg-[#3486cf]/35" : "bg-gray-200"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Override controls */}
      <div className="flex items-center flex-wrap gap-2 mt-2 pt-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Override:</p>
        {OVERRIDE_STATUSES.map((id) => {
          const s        = getStatus(id);
          const isActive = id === currentStatus;
          return (
            <button
              key={id}
              type="button"
              disabled={updating}
              onClick={() => onStatusChange(id)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors disabled:opacity-50 ${
                isActive
                  ? `${s.bg} ${s.text} border-current`
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-600"
              }`}
            >
              {s?.label}
            </button>
          );
        })}
      </div>

      {/* Status history — most recent 4 entries */}
      {history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          {[...history].reverse().slice(0, 4).map((h, i) => {
            const s = getStatus(h.status);
            return (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${s?.bg || "bg-gray-50"} ${s?.text || "text-gray-500"}`}>
                  {s?.label || h.status}
                </span>
                <span>
                  {new Date(h.changedAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric",
                    hour: "numeric", minute: "2-digit",
                  })}
                </span>
                {h.note && <span className="italic truncate">"{h.note}"</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
