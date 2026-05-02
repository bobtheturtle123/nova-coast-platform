"use client";

import { getStatus } from "@/lib/workflowStatus";

export default function WorkflowStatusBadge({ status, size = "sm" }) {
  const s = getStatus(status);
  if (!s) return null;
  const cls =
    size === "xs" ? "text-[10px] px-1.5 py-0.5" :
    size === "lg" ? "text-sm px-3 py-1.5" :
                    "text-xs px-2.5 py-1";
  return (
    <span className={`${cls} rounded-full font-medium whitespace-nowrap ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}
