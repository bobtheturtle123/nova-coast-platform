import { adminDb } from "@/lib/firebase-admin";

// CubiCasa calls this endpoint when an order's status changes.
// Register this URL in your CubiCasa company settings:
//   https://app.cubi.casa/api/integrate/v3  →  Company → Developer → Webhook URL
//   URL: https://app.kyoriaos.com/api/webhooks/cubicasa

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("[cubicasa/webhook] received:", JSON.stringify(body).slice(0, 1000));

    const {
      id: orderId,
      current_status,
      model_id,
      product_type,
      delivery_type,
      // floor plan URLs may come in various fields depending on product_type
      floor_plan_url,
      floor_plan_with_dimensions_url,
      image_url,
      files,
      deliverables,
      user_email,
      email,
      property_address,
      address,
    } = body;

    // Only process orders that are Ready (have deliverables)
    if (current_status !== "Ready") {
      return Response.json({ ok: true, skipped: `status=${current_status}` });
    }

    if (!orderId) {
      return Response.json({ ok: true, skipped: "no order id" });
    }

    // Extract floor plan URLs from whichever field CubiCasa uses
    const floorPlanUrl = floor_plan_url
      ?? files?.find((f) => f.type === "floor_plan" || f.type === "2d")?.url
      ?? deliverables?.find((f) => f.type === "floor_plan" || f.type === "2d")?.url
      ?? image_url
      ?? null;

    const floorPlanWithDimensionsUrl = floor_plan_with_dimensions_url
      ?? files?.find((f) => f.type?.includes("dimension"))?.url
      ?? deliverables?.find((f) => f.type?.includes("dimension"))?.url
      ?? null;

    const ownerEmail = user_email || email || null;
    const orderAddress = property_address || address || null;

    // Find the tenant whose cubiCasaCredentials.email matches the order's user
    // Fall back to storing in a top-level cubicasaOrders collection if no match
    let tenantId = null;
    if (ownerEmail) {
      const tenantsSnap = await adminDb
        .collection("tenants")
        .where("cubiCasaCredentials.email", "==", ownerEmail)
        .limit(1)
        .get();
      if (!tenantsSnap.empty) tenantId = tenantsSnap.docs[0].id;
    }

    const orderData = {
      orderId,
      status: current_status,
      modelId: model_id || null,
      productType: product_type || null,
      deliveryType: delivery_type || null,
      address: orderAddress,
      floorPlanUrl,
      floorPlanWithDimensionsUrl,
      allFiles: files || deliverables || [],
      userEmail: ownerEmail,
      tenantId,
      receivedAt: new Date(),
      raw: body,
    };

    // Store in top-level collection for lookup
    await adminDb.collection("cubicasaOrders").doc(orderId).set(orderData, { merge: true });

    // Also store under tenant if we matched one
    if (tenantId) {
      await adminDb
        .collection("tenants").doc(tenantId)
        .collection("cubicasaOrders").doc(orderId)
        .set(orderData, { merge: true });
    }

    console.log(`[cubicasa/webhook] stored order ${orderId} tenant=${tenantId} floorPlan=${floorPlanUrl}`);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[cubicasa/webhook] error:", e?.message || e);
    // Always return 200 to CubiCasa so they don't retry indefinitely
    return Response.json({ ok: true, error: e.message });
  }
}
