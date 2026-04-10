import { adminDb, adminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// MCP server info
const SERVER_INFO = {
  name: "novaos-platform",
  version: "1.0.0",
  description: "NovaOS real estate photography platform — access bookings, galleries, and client data",
};

const TOOLS = [
  {
    name: "list_bookings",
    description: "List all bookings/listings for the authenticated tenant",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: pending_payment, confirmed, completed, cancelled" },
        limit:  { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "get_booking",
    description: "Get full details for a specific booking by ID",
    inputSchema: {
      type: "object",
      properties: {
        bookingId: { type: "string", description: "The booking ID" },
      },
      required: ["bookingId"],
    },
  },
  {
    name: "list_gallery_media",
    description: "List media files in a booking's gallery",
    inputSchema: {
      type: "object",
      properties: {
        bookingId: { type: "string", description: "The booking ID whose gallery to list" },
      },
      required: ["bookingId"],
    },
  },
];

async function getCtxFromApiKey(req) {
  // Support Bearer token auth for MCP
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, uid: decoded.uid };
  } catch { return null; }
}

async function executeTool(name, input, ctx) {
  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);

  if (name === "list_bookings") {
    let query = tenantRef.collection("bookings").orderBy("createdAt", "desc").limit(input.limit || 20);
    if (input.status) query = query.where("status", "==", input.status);
    const snap = await query.get();
    const bookings = snap.docs.map((d) => {
      const b = d.data();
      return {
        id: d.id,
        clientName: b.clientName,
        address: b.fullAddress || b.address,
        status: b.status,
        totalPrice: b.totalPrice,
        depositPaid: b.depositPaid,
        paidInFull: b.paidInFull,
        preferredDate: b.preferredDate,
        createdAt: b.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    return { bookings, count: bookings.length };
  }

  if (name === "get_booking") {
    const doc = await tenantRef.collection("bookings").doc(input.bookingId).get();
    if (!doc.exists) return { error: "Booking not found" };
    const b = doc.data();
    // Serialize dates
    const out = { ...b };
    for (const k of Object.keys(out)) {
      if (out[k]?.toDate) out[k] = out[k].toDate().toISOString();
    }
    return out;
  }

  if (name === "list_gallery_media") {
    const bookingDoc = await tenantRef.collection("bookings").doc(input.bookingId).get();
    if (!bookingDoc.exists) return { error: "Booking not found" };
    const { galleryId } = bookingDoc.data();
    if (!galleryId) return { media: [], message: "No gallery exists for this booking" };
    const galleryDoc = await tenantRef.collection("galleries").doc(galleryId).get();
    if (!galleryDoc.exists) return { media: [], message: "Gallery not found" };
    const { media = [], unlocked, delivered } = galleryDoc.data();
    return { galleryId, unlocked, delivered, mediaCount: media.length, media: media.slice(0, 50) };
  }

  return { error: `Unknown tool: ${name}` };
}

// GET — MCP initialization (returns server capabilities)
export async function GET(req) {
  const ctx = await getCtxFromApiKey(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  return Response.json({
    jsonrpc: "2.0",
    result: {
      serverInfo: SERVER_INFO,
      capabilities: { tools: {} },
      tools: TOOLS,
    },
  });
}

// POST — handle MCP JSON-RPC requests
export async function POST(req) {
  const ctx = await getCtxFromApiKey(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try { body = await req.json(); }
  catch { return Response.json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }); }

  const { method, params, id } = body;

  try {
    if (method === "initialize") {
      return Response.json({
        jsonrpc: "2.0", id,
        result: {
          serverInfo: SERVER_INFO,
          capabilities: { tools: {} },
          protocolVersion: "2024-11-05",
        },
      });
    }

    if (method === "tools/list") {
      return Response.json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    }

    if (method === "tools/call") {
      const { name, arguments: toolArgs } = params;
      const result = await executeTool(name, toolArgs || {}, ctx);
      return Response.json({
        jsonrpc: "2.0", id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !!result.error,
        },
      });
    }

    return Response.json({
      jsonrpc: "2.0", id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  } catch (err) {
    console.error("MCP error:", err);
    return Response.json({
      jsonrpc: "2.0", id,
      error: { code: -32603, message: "Internal error", data: err.message },
    });
  }
}
