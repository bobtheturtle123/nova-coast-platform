import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { randomBytes } from "crypto";

export async function POST(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(auth);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!decoded.tenantId || decoded.role !== "owner") {
    return Response.json({ error: "Owner access required" }, { status: 403 });
  }

  const tenantRef = adminDb.collection("tenants").doc(decoded.tenantId);
  const doc = await tenantRef.get();
  if (!doc.exists) return Response.json({ error: "Not found" }, { status: 404 });

  let token = doc.data().ownerCalendarToken;
  if (!token) {
    token = randomBytes(32).toString("hex");
    await tenantRef.update({ ownerCalendarToken: token });
  }

  return Response.json({ token });
}
