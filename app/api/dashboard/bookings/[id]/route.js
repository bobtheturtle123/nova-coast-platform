import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { sendBookingApproved } from "@/lib/email";
import { getTenantById } from "@/lib/tenants";
import { v4 as uuidv4 } from "uuid";
import { Resend } from "resend";

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
    "status", "workflowStatus", "shootDate", "shootTime", "preferredTime",
    "additionalAppointments",
    // Photographer assignment
    "photographerId", "photographerEmail", "photographerName", "photographerPhone",
    "additionalPhotographers",
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

  const bookingRef = adminDb.collection("tenants").doc(ctx.tenantId).collection("bookings").doc(params.id);
  const prevSnap = await bookingRef.get();
  const prev = prevSnap.data() || {};

  await bookingRef.update(update);

  // Send photographer notification when photographer is newly assigned or changed
  const newPhotographerEmail = update.photographerEmail;
  if (newPhotographerEmail && newPhotographerEmail !== prev.photographerEmail) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const tenant = await getTenantById(ctx.tenantId);
        if (tenant) {
          const bizName   = tenant.branding?.businessName || tenant.businessName || "KyoriaOS";
          const primary   = tenant.branding?.primaryColor || "#3486cf";
          const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com";
          const from      = `${bizName} <${fromEmail}>`;
          const address   = update.fullAddress || prev.fullAddress || prev.address || "Property";
          const shootDate = update.shootDate || prev.shootDate;
          const shootTime = update.shootTime || prev.shootTime;
          const clientName = prev.clientName || "";
          const clientPhone = prev.clientPhone || "";
          const shootInfo = shootDate
            ? `${new Date(shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${shootTime ? ` at ${shootTime}` : ""}`
            : null;

          await new Resend(resendKey).emails.send({
            from, to: [newPhotographerEmail],
            subject: `Shoot assigned to you — ${address}`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
              <h2 style="color:${primary};font-family:Georgia,serif;margin:0 0 12px">Shoot Assigned</h2>
              <p style="color:#555;margin:0 0 20px">Hi ${update.photographerName || "there"},</p>
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;width:36%">Property</td>
                    <td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:500">${address}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Client</td>
                    <td style="padding:8px 0;border-bottom:1px solid #eee">${clientName}${clientPhone ? ` · ${clientPhone}` : ""}</td></tr>
                ${shootInfo ? `<tr><td style="padding:8px 0;color:#888;font-size:13px">Scheduled</td>
                    <td style="padding:8px 0;font-weight:500">${shootInfo}</td></tr>` : ""}
              </table>
              <p style="color:#ccc;font-size:11px">${bizName}</p>
            </div>`,
          }).then(() => console.log("[email] photographer assignment sent to", newPhotographerEmail))
            .catch((e) => console.error("[email] photographer assignment FAILED to", newPhotographerEmail, ":", e?.message));
        }
      } catch (e) {
        console.error("[email] photographer assignment error (non-fatal):", e?.message);
      }
    }
  }

  return Response.json({ ok: true });
}
