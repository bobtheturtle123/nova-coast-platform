import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import Link from "next/link";
import AgentTokenPersist from "@/components/AgentTokenPersist";
import AgentSessionCheck from "@/components/AgentSessionCheck";

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AgentListingsPage({ params, searchParams }) {
  const { slug } = params;
  const token    = searchParams?.token;

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return <ErrorScreen message="Business not found." />;

  if (!token) return <AgentSessionCheck slug={slug} />;

  const agentsSnap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("agents")
    .where("accessToken", "==", token)
    .limit(1)
    .get();

  if (agentsSnap.empty) return <ErrorScreen message="Invalid or expired link." />;
  const agent = agentsSnap.docs[0].data();

  const bookingsSnap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("bookings")
    .where("clientEmail", "==", agent.email)
    .get();

  const bookings = bookingsSnap.docs
    .sort((a, b) => {
      const aT = a.data().createdAt?.toMillis?.() ?? 0;
      const bT = b.data().createdAt?.toMillis?.() ?? 0;
      return bT - aT;
    })
    .map((d) => {
      const data = d.data();
      return {
        id:             d.id,
        address:        data.fullAddress || data.address || "Property",
        status:         data.status || "confirmed",
        workflowStatus: data.workflowStatus || null,
        shootDate:      data.shootDate?.toDate?.()?.toISOString?.() ?? null,
        galleryId:      data.galleryId  || null,
        propertyWebsite: data.propertyWebsite || null,
        totalPrice:     data.totalPrice || 0,
        createdAt:      data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

  // Fetch gallery status and cover images in parallel
  const galleryIds = bookings.filter((b) => b.galleryId).map((b) => b.galleryId);
  const galleries  = {};
  await Promise.all(
    galleryIds.map(async (gid) => {
      const gDoc = await adminDb.collection("tenants").doc(tenant.id).collection("galleries").doc(gid).get();
      if (gDoc.exists) {
        const g = gDoc.data();
        const photos = (g.media || []).filter((m) => !m.fileType?.startsWith("video/"));
        galleries[gid] = {
          delivered:   g.delivered   || false,
          accessToken: g.accessToken || null,
          mediaCount:  photos.length,
          coverUrl:    g.coverUrl || photos[0]?.url || null,
        };
      }
    })
  );

  const primary = tenant.branding?.primaryColor || "#3486cf";

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-gray-900">My Listings</h1>
          <p className="text-sm text-gray-400 mt-1">{bookings.length} listing{bookings.length !== 1 ? "s" : ""} · {agent.email}</p>
        </div>
        <Link
          href={`/${slug}/book`}
          className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-white transition-opacity hover:opacity-90"
          style={{ background: primary }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Book New Shoot
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🏡</p>
          <p className="font-medium text-gray-500">No listings yet</p>
          <p className="text-sm mt-1">Your listings will appear here once the photographer has created them.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookings.map((b) => {
            const gal         = b.galleryId ? galleries[b.galleryId] : null;
            const isDelivered = !!gal?.delivered;

            return (
              <div key={b.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow group">
                {/* Hero image */}
                <div className="relative aspect-video bg-gray-100 overflow-hidden">
                  {gal?.coverUrl ? (
                    <img
                      src={gal.coverUrl}
                      alt={b.address}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#D1D5DB" strokeWidth="1.2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      {b.shootDate && (
                        <p className="text-xs text-gray-400">{formatDate(b.shootDate)}</p>
                      )}
                    </div>
                  )}
                  {/* Status badge */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm ${
                      isDelivered
                        ? "bg-emerald-50/90 text-emerald-700 border-emerald-200"
                        : "bg-amber-50/90 text-amber-700 border-amber-200"
                    }`}>
                      {isDelivered ? "Delivered" : "In Progress"}
                    </span>
                  </div>
                </div>

                {/* Card content */}
                <div className="p-4">
                  <p className="font-semibold text-gray-900 text-sm leading-snug mb-1 line-clamp-2">{b.address}</p>
                  {b.shootDate && (
                    <p className="text-xs text-gray-400 mb-3">{formatDate(b.shootDate)}</p>
                  )}
                  {!b.shootDate && (
                    <p className="text-xs text-gray-300 mb-3">Date TBD</p>
                  )}
                  <Link
                    href={`/${slug}/agent/${b.id}?token=${token}`}
                    className="block w-full text-center text-sm font-semibold py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ background: primary }}
                  >
                    View →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AgentTokenPersist slug={slug} token={token} />
    </main>
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
