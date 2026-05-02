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
    id:    "photographer_assigned",
    label: "Photographer Assigned",
    color: "#7C3AED",
    bg:    "bg-purple-50",
    text:  "text-purple-700",
    desc:  "Photographer assigned to the shoot.",
  },
  {
    id:    "shot_completed",
    label: "Shot Completed",
    color: "#0891B2",
    bg:    "bg-cyan-50",
    text:  "text-cyan-700",
    desc:  "Shoot done — media in editing.",
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
    id:    "editing_complete",
    label: "Editing Complete",
    color: "#059669",
    bg:    "bg-emerald-50",
    text:  "text-emerald-700",
    desc:  "Media edited and ready for QA.",
  },
  {
    id:    "qa_review",
    label: "QA Review",
    color: "#CA8A04",
    bg:    "bg-yellow-50",
    text:  "text-yellow-700",
    desc:  "Under quality review before delivery.",
  },
  {
    id:    "delivered",
    label: "Delivered",
    color: "#16A34A",
    bg:    "bg-green-50",
    text:  "text-green-700",
    desc:  "Media delivered to client.",
  },
  {
    id:    "paid",
    label: "Paid",
    color: "#0F172A",
    bg:    "bg-gray-100",
    text:  "text-gray-800",
    desc:  "Balance received. Job complete.",
  },
];

// Forward production pipeline — Postponed and Cancelled are override states
export const PIPELINE_ORDER = [
  "booked",
  "appointment_confirmed",
  "photographer_assigned",
  "shot_completed",
  "editing_complete",
  "qa_review",
  "delivered",
  "paid",
];

export const OVERRIDE_STATUSES = ["postponed", "cancelled"];

export function getStatus(id) {
  return WORKFLOW_STATUSES.find((s) => s.id === id) || null;
}

// Derive workflowStatus from legacy booking.status when workflowStatus is absent
export function resolveWorkflowStatus(booking) {
  if (booking.workflowStatus) return booking.workflowStatus;
  switch (booking.status) {
    case "requested":  return "booked";
    case "confirmed":  return "appointment_confirmed";
    case "completed":  return "shot_completed";
    case "cancelled":  return "cancelled";
    default:           return "booked";
  }
}
