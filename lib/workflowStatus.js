export const WORKFLOW_STATUSES = [
  {
    id:    "booked",
    label: "Booked",
    color: "#64748B",
    bg:    "bg-slate-100",
    text:  "text-slate-600",
    desc:  "Booking received and on the calendar.",
  },
  {
    id:    "appointment_confirmed",
    label: "Appt. Confirmed",
    color: "#3486cf",
    bg:    "bg-[#EEF5FC]",
    text:  "text-[#1E5A8A]",
    desc:  "Shoot date and time confirmed with client.",
  },
  {
    id:    "postponed",
    label: "Postponed",
    color: "#D97706",
    bg:    "bg-amber-50",
    text:  "text-amber-700",
    desc:  "Shoot postponed — awaiting rescheduling.",
  },
  {
    id:    "cancelled",
    label: "Cancelled",
    color: "#DC2626",
    bg:    "bg-red-50",
    text:  "text-red-600",
    desc:  "Booking cancelled.",
  },
  {
    id:    "delivered",
    label: "Delivered",
    color: "#16A34A",
    bg:    "bg-green-50",
    text:  "text-green-700",
    desc:  "Media delivered to agent.",
  },
  {
    id:    "revisions",
    label: "Revisions",
    color: "#D97706",
    bg:    "bg-amber-50",
    text:  "text-amber-700",
    desc:  "Agent submitted revision requests.",
  },
  {
    id:    "completed",
    label: "Completed",
    color: "#0F172A",
    bg:    "bg-gray-100",
    text:  "text-gray-800",
    desc:  "Delivered, paid, and all revisions resolved.",
  },
];

export function getStatus(id) {
  return WORKFLOW_STATUSES.find((s) => s.id === id) || null;
}

/**
 * Compute workflow status from booking state + optional gallery/revisions context.
 * Called by API routes when a verifiable event occurs.
 */
export function computeWorkflowStatus(booking, { isDelivered = false, hasPendingRevisions = false } = {}) {
  if (booking.status === "cancelled") return "cancelled";
  if (booking.workflowStatus === "postponed") return "postponed";
  if (hasPendingRevisions) return "revisions";
  const isPaid = !!(booking.paidInFull || booking.balancePaid);
  if (isDelivered && isPaid) return "completed";
  if (isDelivered) return "delivered";
  if (booking.shootDate || booking.scheduleApprovalStatus === "confirmed") return "appointment_confirmed";
  return "booked";
}

/**
 * Resolve the display status for a booking.
 * Pass { gallery, revisions } when available for precise computation;
 * falls back to stored workflowStatus otherwise.
 */
export function resolveWorkflowStatus(booking, opts = {}) {
  if (!booking) return "booked";
  if (booking.status === "cancelled") return "cancelled";

  const { gallery, revisions } = opts;

  // When context is available, always compute from live data
  if (gallery !== undefined || revisions !== undefined) {
    return computeWorkflowStatus(booking, {
      isDelivered:         !!gallery?.delivered,
      hasPendingRevisions: Array.isArray(revisions) && revisions.some((r) => r.status === "pending"),
    });
  }

  // No context: use the stored value set by event APIs
  if (booking.workflowStatus) return booking.workflowStatus;

  // Legacy fallback from booking.status
  if (booking.status === "requested") return "booked";
  if (booking.status === "confirmed") return "appointment_confirmed";
  return "booked";
}
