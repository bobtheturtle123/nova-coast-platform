import { describe, it, expect } from "vitest";
import {
  ROLES, ROLE_IDS, PERMISSION_KEYS, DASHBOARD_ROLES,
  normalizeRole, defaultPermissions,
} from "@/lib/roles";

// These tests lock in least-privilege defaults and role-normalization safety so
// that any future collaborator role (e.g. a QC reviewer) built on this system
// cannot silently inherit elevated access, and untrusted role strings can never
// be normalized into owner/admin.

describe("least-privilege role defaults", () => {
  it("photographer has NO dashboard permissions by default", () => {
    for (const k of PERMISSION_KEYS) expect(ROLES.photographer.permissions[k]).toBe(false);
    expect(ROLES.photographer.dashboard).toBe(false);
  });
  it("custom role starts with ALL permissions off (opt-in only)", () => {
    for (const k of PERMISSION_KEYS) expect(ROLES.custom.permissions[k]).toBe(false);
  });
  it("manager cannot view revenue, manage team, or edit settings by default", () => {
    expect(ROLES.manager.permissions.canViewRevenue).toBe(false);
    expect(ROLES.manager.permissions.canManageTeam).toBe(false);
    expect(ROLES.manager.permissions.canEditSettings).toBe(false);
  });
  it("only admin gets full permissions", () => {
    for (const k of PERMISSION_KEYS) expect(ROLES.admin.permissions[k]).toBe(true);
    for (const role of ["photographer", "manager", "custom"]) {
      const allTrue = PERMISSION_KEYS.every((k) => ROLES[role].permissions[k] === true);
      expect(allTrue).toBe(false);
    }
  });
});

describe("role normalization cannot escalate", () => {
  it("owner is only ever produced from the literal 'owner'", () => {
    expect(normalizeRole("owner")).toBe("owner");
    for (const bad of ["OWNER", "admin ", "0wner", "root", "superadmin", "qc", "reviewer", "", null, undefined, "{}", "[object Object]"]) {
      expect(normalizeRole(bad)).not.toBe("owner");
    }
  });
  it("unknown/injected role strings fall back to the least-privileged dashboard role (custom), never admin", () => {
    for (const bad of ["hacker", "qc", "reviewer", "admin;drop", "superadmin", "manager\n"]) {
      const r = normalizeRole(bad);
      expect(r).not.toBe("admin");
      expect(r).not.toBe("owner");
      expect(ROLE_IDS).toContain(r);
    }
    expect(normalizeRole("totally-unknown")).toBe("custom");
    // custom defaults grant nothing until explicitly permissioned.
    for (const k of PERMISSION_KEYS) expect(defaultPermissions("totally-unknown")[k]).toBe(false);
  });
  it("a missing role defaults to photographer (portal-only, no dashboard)", () => {
    expect(normalizeRole(null)).toBe("photographer");
    expect(DASHBOARD_ROLES).not.toContain("photographer");
  });
});

describe("defaultPermissions is a fresh object (no shared-reference tampering)", () => {
  it("mutating one member's permissions cannot affect the role template", () => {
    const a = defaultPermissions("manager");
    a.canViewRevenue = true;
    const b = defaultPermissions("manager");
    expect(b.canViewRevenue).toBe(false);
    expect(ROLES.manager.permissions.canViewRevenue).toBe(false);
  });
});
