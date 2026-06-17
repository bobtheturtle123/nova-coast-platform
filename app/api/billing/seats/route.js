import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripe, ADDON_PRICE_IDS } from "@/lib/stripe";
import { getAddonCaps } from "@/lib/plans";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    // Only owners/admins can change billing.
    if (decoded.role && decoded.role !== "owner" && decoded.role !== "admin") return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST /api/billing/seats  { quantity }
// Sets the TOTAL number of paid add-on seats on the tenant's subscription.
// Increasing charges the card on file immediately (prorated). Decreasing/removing
// issues NO refund — the lower price simply takes effect next billing cycle.
export async function POST(req) {
  try {
    const ctx = await getCtx(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const priceId = ADDON_PRICE_IDS.extraSeat;
    if (!priceId) {
      return Response.json({ error: "Seat add-on isn't configured. Add STRIPE_PRICE_ADDON_SEAT." }, { status: 400 });
    }

    const { quantity } = await req.json();
    const q = Math.max(0, Math.floor(Number(quantity) || 0));

    const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);
    const tenantDoc = await tenantRef.get();
    if (!tenantDoc.exists) return Response.json({ error: "Tenant not found" }, { status: 404 });
    const tenant = tenantDoc.data();

    if (!tenant.stripeSubscriptionId) {
      return Response.json({ error: "You need an active subscription before adding seats." }, { status: 400 });
    }

    // Enforce the plan's seat-expansion cap.
    const caps = getAddonCaps(tenant.permanentPlan || tenant.subscriptionPlan || "solo");
    if (caps.extraSeats === 0) {
      return Response.json({ error: "Additional seats aren't available on your plan." }, { status: 400 });
    }
    if (caps.extraSeats !== null && q > caps.extraSeats) {
      return Response.json({ error: `Your plan supports up to ${caps.extraSeats} additional seats.` }, { status: 400 });
    }

    const sub  = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
    const item = sub.items.data.find((i) => i.price?.id === priceId);
    const current = item ? (item.quantity || 0) : 0;

    if (q === current) {
      return Response.json({ ok: true, addonSeats: q, unchanged: true });
    }

    const increasing = q > current;
    let items;
    if (item) {
      items = q === 0 ? [{ id: item.id, deleted: true }] : [{ id: item.id, quantity: q }];
    } else {
      items = [{ price: priceId, quantity: q }];
    }

    await stripe.subscriptions.update(sub.id, {
      items,
      // Adding: bill the prorated difference now. Removing: no credit — the
      // reduced amount simply applies from the next invoice (they keep what they
      // already paid for this period).
      proration_behavior: increasing ? "always_invoice" : "none",
    });

    // Reflect immediately for the UI; the subscription.updated webhook will also
    // recompute addonSeats from the line items as the source of truth.
    await tenantRef.update({ addonSeats: q });

    return Response.json({ ok: true, addonSeats: q, charged: increasing });
  } catch (err) {
    console.error("Seats update error:", err);
    return Response.json({ error: "Could not update seats. Please try again." }, { status: 500 });
  }
}
