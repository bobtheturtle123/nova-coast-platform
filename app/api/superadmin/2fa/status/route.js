import { getSuperAdminCtx, isSuperAdminVerified } from "@/lib/superadmin";

export const dynamic = "force-dynamic";

// Tells the UI whether the current superadmin still has a valid 2FA session.
export async function GET(req) {
  const ctx = await getSuperAdminCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const verified = await isSuperAdminVerified(req);
  return Response.json({
    verified,
    email: (ctx.email || "").replace(/(.{2}).*(@.*)/, "$1***$2"),
  });
}
