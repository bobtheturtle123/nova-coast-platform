import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function cookieName(slug) {
  return `agt_${slug}`;
}

const COOKIE_OPTS = {
  httpOnly:  true,
  sameSite:  "lax",
  path:      "/",
  maxAge:    60 * 60 * 24 * 30, // 30 days
};

// POST — establish session (accepts UUID token in body OR Firebase ID token in Authorization header)
export async function POST(req, { params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let agentDoc = null;

  const firebaseToken = req.headers.get("Authorization")?.replace("Bearer ", "");
  const body          = await req.json().catch(() => ({}));
  const uuidToken     = body.token;

  if (firebaseToken) {
    // Firebase Auth flow — verify ID token, find agent by email
    try {
      const decoded = await adminAuth.verifyIdToken(firebaseToken);
      const email   = decoded.email?.toLowerCase();
      if (!email) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

      const snap = await adminDb
        .collection("tenants").doc(tenant.id)
        .collection("agents")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (snap.empty) return NextResponse.json({ error: "No agent account for this email" }, { status: 404 });
      agentDoc = snap.docs[0];
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (uuidToken) {
    // UUID invite-token flow (first visit or legacy)
    const snap = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("agents")
      .where("accessToken", "==", uuidToken)
      .limit(1)
      .get();

    if (snap.empty) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    agentDoc = snap.docs[0];
  } else {
    return NextResponse.json({ error: "No credentials provided" }, { status: 400 });
  }

  const accessToken = agentDoc.data().accessToken;
  if (!accessToken) return NextResponse.json({ error: "Agent has no access token" }, { status: 403 });

  const d   = agentDoc.data();
  const res = NextResponse.json({
    ok:          true,
    accessToken,
    agent: { name: d.name || "", email: d.email || "", phone: d.phone || "" },
  });

  res.cookies.set(cookieName(params.slug), accessToken, {
    ...COOKIE_OPTS,
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}

// DELETE — clear session cookie
export async function DELETE(req, { params }) {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(cookieName(params.slug));
  return res;
}

// GET — verify session and return agent info
export async function GET(req, { params }) {
  const cookieStore = cookies();
  const token       = cookieStore.get(cookieName(params.slug))?.value;
  if (!token) return NextResponse.json({ error: "No session" }, { status: 401 });

  const tenant = await getTenantBySlug(params.slug);
  if (!tenant)  return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("agents")
    .where("accessToken", "==", token)
    .limit(1)
    .get();

  if (snap.empty) {
    const res = NextResponse.json({ error: "Session expired" }, { status: 401 });
    res.cookies.delete(cookieName(params.slug));
    return res;
  }

  const d = snap.docs[0].data();
  return NextResponse.json({
    accessToken: token,
    agent: { name: d.name || "", email: d.email || "", phone: d.phone || "" },
  });
}
