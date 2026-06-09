import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { Resend } from "resend";

const MAX_ROWS = 500;

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { uid: decoded.uid, tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let contacts;
  try {
    const body = await req.json();
    contacts = body.contacts;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return Response.json({ error: "No contacts provided" }, { status: 400 });
  }

  if (contacts.length > MAX_ROWS) {
    contacts = contacts.slice(0, MAX_ROWS);
  }

  const tenantRef  = adminDb.collection("tenants").doc(ctx.tenantId);
  const agentsCol  = tenantRef.collection("agents");
  const tenantSnap = await tenantRef.get();
  const tenant     = tenantSnap.data() || {};
  const ownerEmail = tenant.email || null;

  // Collect existing emails to skip duplicates efficiently
  const existingSnap = await agentsCol.select("email").get();
  const existingEmails = new Set(existingSnap.docs.map((d) => (d.data().email || "").toLowerCase()));

  let imported = 0;
  let skipped  = 0;

  // Process in Firestore batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const chunk = contacts.slice(i, i + BATCH_SIZE);
    const batch = adminDb.batch();
    let batchHasWrites = false;

    for (const c of chunk) {
      const email = (c.email || "").toLowerCase().trim();
      if (!email) { skipped++; continue; }
      if (existingEmails.has(email)) { skipped++; continue; }

      const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || email;
      const agentId = Buffer.from(email).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
      const ref = agentsCol.doc(agentId);

      batch.set(ref, {
        id:          agentId,
        name,
        email,
        phone:       (c.phone  || "").toString().trim(),
        company:     (c.company || "").trim(),
        notes:       (c.notes   || "").trim(),
        totalOrders: 0,
        totalSpent:  0,
        firstOrderAt: new Date(),
        lastOrderAt:  new Date(),
        importedAt:   new Date(),
      }, { merge: false });

      existingEmails.add(email);
      imported++;
      batchHasWrites = true;
    }

    if (batchHasWrites) await batch.commit();
  }

  // Send confirmation email to owner
  if (ownerEmail && process.env.RESEND_API_KEY) {
    try {
      const resend    = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com";
      await resend.emails.send({
        from:    `KyoriaOS <${fromEmail}>`,
        to:      [ownerEmail],
        subject: `Customer import complete — ${imported} contacts added`,
        html:    `<p>Your customer import is complete.</p>
                  <ul>
                    <li><strong>${imported}</strong> contact${imported !== 1 ? "s" : ""} imported</li>
                    <li><strong>${skipped}</strong> duplicate${skipped !== 1 ? "s" : ""} skipped</li>
                  </ul>
                  <p>You can view your customers at <a href="https://kyoriaos.com/dashboard/agents">kyoriaos.com/dashboard/agents</a>.</p>`,
      });
    } catch { /* email failure is non-fatal */ }
  }

  return Response.json({ imported, skipped });
}
