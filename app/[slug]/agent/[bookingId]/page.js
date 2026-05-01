import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import Link from "next/link";
import AgentBookingClient from "./AgentBookingClient";

export default async function AgentBookingPage({ params, searchParams }) {
  const { slug, bookingId } = params;
  const token = searchParams?.token;

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return <ErrorScreen message="Business not found." />;

  // Verify token
  if (!token) return <ErrorScreen message="No access token. Check your link." />;

  const agentsSnap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("agents")
    .where("accessToken", "==", token)
    .limit(1)
    .get();

  if (agentsSnap.empty) return <ErrorScreen message="Invalid or expired link." />;

  const agent = agentsSnap.docs[0].data();

  // Fetch booking
  const bookingDoc = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("bookings").doc(bookingId)
    .get();

  if (!bookingDoc.exists) return <ErrorScreen message="Listing not found." />;

  const bookingData = bookingDoc.data();
  // Verify the agent owns this booking
  if (bookingData.clientEmail?.toLowerCase() !== agent.email?.toLowerCase()) {
    return <ErrorScreen message="You don't have access to this listing." />;
  }

  // Sanitize propertyWebsite — strip any Firestore Timestamps so props serialize cleanly
  function sanitizePw(obj) {
    if (!obj || typeof obj !== "object") return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v?.toDate) out[k] = v.toDate().toISOString();
      else if (v && typeof v === "object" && !Array.isArray(v)) out[k] = sanitizePw(v);
      else out[k] = v;
    }
    return out;
  }

  const booking = {
    id:              bookingId,
    address:         bookingData.fullAddress || bookingData.address || "Property",
    clientName:      bookingData.clientName  || "",
    status:          bookingData.status      || "confirmed",
    shootDate:       bookingData.shootDate?.toDate?.()?.toISOString?.() ?? (typeof bookingData.shootDate === "string" ? bookingData.shootDate : null),
    propertyWebsite: bookingData.propertyWebsite ? sanitizePw(bookingData.propertyWebsite) : null,
    totalPrice:      bookingData.totalPrice  || 0,
    remainingBalance: bookingData.remainingBalance || 0,
  };

  // Fetch gallery
  let gallery = null;
  if (bookingData.galleryId) {
    const galleryDoc = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("galleries").doc(bookingData.galleryId)
      .get();
    if (galleryDoc.exists) {
      const gd = galleryDoc.data();
      const media  = gd.media || [];
      const images = media.filter((m) => !m.fileType?.startsWith("video/"));
      const videos = media.filter((m) =>  m.fileType?.startsWith("video/"));
      gallery = {
        id:           bookingData.galleryId,
        delivered:    gd.delivered    || false,
        unlocked:     gd.unlocked     || false,
        accessToken:  gd.accessToken  || null,
        matterportUrl: gd.matterportUrl || null,
        videoUrl:     gd.videoUrl     || null,
        imageCount:   images.length,
        videoCount:   videos.length,
        coverUrl:     images[0]?.url || null,
      };
    }
  }

  const branding = {
    primary: tenant.branding?.primaryColor || "#3486cf",
    accent:  tenant.branding?.accentColor  || "#c9a96e",
    bizName: tenant.branding?.businessName || tenant.businessName || "",
  };

  return (
    <AgentBookingClient
      booking={booking}
      gallery={gallery}
      branding={branding}
      slug={slug}
      token={token}
    />
  );
}

function ErrorScreen({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-gray-700 font-medium mb-2">Access Required</p>
        <p className="text-gray-400 text-sm">{message}</p>
      </div>
    </div>
  );
}
