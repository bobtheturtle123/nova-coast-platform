import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { sendBookingApproved } from "@/lib/email";
import { getTenantById } from "@/lib/tenants";
import { v4 as uuidv4 } from "uuid";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function GET(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .get();

  if (!doc.exists) return Response.json({ error: "Not found" }, { status: 404 });
  const data = doc.data();
  for (const key of ["createdAt", "updatedAt", "preferredDate", "shootDate"]) {
    if (data[key]?._seconds) data[key] = new Date(data[key]._seconds * 1000).toISOString();
    else if (data[key]?.toDate) data[key] = data[key].toDate().toISOString();
  }
  return Response.json({ booking: { id: doc.id, ...data } });
}

export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = [
    // Scheduling & status
    "status", "workflowStatus", "shootDate", "shootTime",
    // Photographer assignment
    "photographerId", "photographerEmail", "photographerName", "photographerPhone",
    // Notes & website
    "notes", "propertyWebsite",
    // Client info
    "clientName", "clientEmail", "clientPhone",
    // Property / address
    "address", "addressLine", "city", "state", "zip", "fullAddress", "squareFootage", "propertyType",
    // Services
    "packageId", "serviceIds", "addonIds", "totalPrice",
    // Payment overrides
    "depositPaid", "depositAmount", "balancePaid", "remainingBalance",
    "offlinePaymentAmount", "offlinePaymentMethod", "offlinePaymentNote",
  ];
  const update = {};
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  update.updatedAt = new Date();

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .update(update);

  return Response.json({ ok: true });
}
