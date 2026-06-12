// Canonical team roles — the single source of truth for the whole app.
//
// We intentionally keep this small: Photographer, Manager, Admin, and a Custom
// role where the tenant sets their own title and chooses exactly which
// permissions apply. Older role names (editor, coordinator, assistant) are
// auto-mapped to this set so nothing silently changes a member's access.

export const PERMISSION_KEYS = [
  "canViewListings",
  "canCreateBookings",
  "canViewRevenue",
  "canViewReports",
  "canManageTeam",
  "canManageProducts",
  "canEditSettings",
  "canImportDropbox",
];

const allPerms = (v) => Object.fromEntries(PERMISSION_KEYS.map((k) => [k, v]));

export const ROLES = {
  photographer: {
    id: "photographer", label: "Photographer", icon: "📷",
    desc: "Shoots jobs. Appears in the booking schedule and gets shoot notifications. Photographer portal only.",
    dashboard: false, shoots: true,
    permissions: allPerms(false),
  },
  manager: {
    id: "manager", label: "Manager", icon: "📋",
    desc: "Logs into the dashboard. Manages bookings, galleries, and products. Does not appear in the schedule by default.",
    dashboard: true, shoots: false,
    permissions: { ...allPerms(false), canViewListings: true, canCreateBookings: true, canManageProducts: true },
  },
  admin: {
    id: "admin", label: "Admin", icon: "🔑",
    desc: "Full dashboard access including revenue, reports, team, and settings.",
    dashboard: true, shoots: false,
    permissions: allPerms(true),
  },
  custom: {
    id: "custom", label: "Custom", icon: "⚙️",
    desc: "Set your own role title and choose exactly which permissions apply.",
    dashboard: true, shoots: false,
    permissions: allPerms(false),
  },
};

export const ROLE_IDS = ["photographer", "manager", "admin", "custom"];

// Roles that get dashboard (staff) access vs. the photographer portal.
// Custom members reach the dashboard only if they hold at least one permission
// (see hasDashboardAccess), but they use the staff invite path either way.
export const DASHBOARD_ROLES = ["manager", "admin", "custom"];

// Roles that do NOT shoot, so they don't appear in scheduling by default.
export const NON_SHOOTING = ["manager", "admin"];

// Legacy / removed role names → current canonical role.
const LEGACY = {
  editor:      "custom",
  coordinator: "manager",
  assistant:   "photographer",
};

// Map any stored role (including legacy/unknown) to the canonical set.
export function normalizeRole(role) {
  if (!role) return "photographer";
  if (role === "owner") return "owner";
  if (ROLE_IDS.includes(role)) return role;
  return LEGACY[role] || "custom";
}

export function defaultPermissions(role) {
  const r = normalizeRole(role);
  return { ...(ROLES[r]?.permissions || ROLES.custom.permissions) };
}

// Display label, honoring a custom role's title.
export function roleLabel(member) {
  const r = normalizeRole(member?.role);
  if (r === "owner")  return "Owner";
  if (r === "custom") return (member?.customRoleTitle || "").trim() || "Custom";
  return ROLES[r]?.label || "Team Member";
}

// Whether a member appears in scheduling. The explicit per-member flag wins;
// otherwise fall back to whether the (normalized) role shoots.
export function shootsSchedule(member) {
  if (member?.showInScheduling !== undefined) return !!member.showInScheduling;
  return !NON_SHOOTING.includes(normalizeRole(member?.role));
}

// Does a member reach the dashboard at all?
export function hasDashboardAccess(member) {
  const r = normalizeRole(member?.role);
  if (r === "owner" || r === "admin" || r === "manager") return true;
  if (r === "custom") return PERMISSION_KEYS.some((k) => member?.permissions?.[k]);
  return false;
}
