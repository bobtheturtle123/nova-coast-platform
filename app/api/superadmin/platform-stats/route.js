import { adminDb } from "@/lib/firebase-admin";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

// GET /api/superadmin/platform-stats
// Lightweight operational cost observability for internal monitoring.
// Returns current-month counters for AI calls, SMS, email, uploads, storage.
export async function GET(req) {
  const auth = req.headers.get("Authorization");
  if (!ADMIN_SECRET || auth !== `Bearer ${ADMIN_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now       = new Date();
  const monthKey  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey   = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

  try {
    const [tenantsSnap, currentStatsDoc, prevStatsDoc] = await Promise.all([
      adminDb.collection("tenants").count().get(),
      adminDb.collection("_platformStats").doc(monthKey).get(),
      adminDb.collection("_platformStats").doc(prevKey).get(),
    ]);

    const current = currentStatsDoc.exists ? currentStatsDoc.data() : {};
    const prev    = prevStatsDoc.exists    ? prevStatsDoc.data()    : {};

    // Aggregate active tenant counts by plan
    const tenantsSnap2 = await adminDb.collection("tenants")
      .where("subscriptionStatus", "in", ["active", "trialing"])
      .get();

    const planBreakdown = {};
    for (const doc of tenantsSnap2.docs) {
      const plan = doc.data().subscriptionPlan || "unknown";
      planBreakdown[plan] = (planBreakdown[plan] || 0) + 1;
    }

    // Count scheduled deliveries pending/sent this month
    const [pendingDeliveries, scheduledDeliveriesThisMonth] = await Promise.all([
      adminDb.collection("scheduledDeliveries")
        .where("status", "==", "pending")
        .count().get(),
      adminDb.collection("scheduledDeliveries")
        .where("createdAt", ">=", new Date(now.getFullYear(), now.getMonth(), 1))
        .count().get(),
    ]);

    return Response.json({
      month: monthKey,
      tenants: {
        total:  tenantsSnap.data().count,
        active: tenantsSnap2.size,
        byPlan: planBreakdown,
      },
      currentMonth: {
        aiCalls:        current.aiCalls        || 0,
        aiTokensEst:    current.aiTokensEst    || 0,
        smsSent:        current.smsSent        || 0,
        emailsSent:     current.emailsSent     || 0,
        uploadsCount:   current.uploadsCount   || 0,
        uploadsMb:      Math.round((current.uploadBytes || 0) / 1024 / 1024),
        fallbackCalls:  current.aiFallbackCalls || 0,
      },
      previousMonth: {
        aiCalls:        prev.aiCalls        || 0,
        smsSent:        prev.smsSent        || 0,
        emailsSent:     prev.emailsSent     || 0,
        uploadsMb:      Math.round((prev.uploadBytes || 0) / 1024 / 1024),
      },
      deliveries: {
        pendingScheduled: pendingDeliveries.data().count,
        createdThisMonth: scheduledDeliveriesThisMonth.data().count,
      },
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[superadmin/platform-stats] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
