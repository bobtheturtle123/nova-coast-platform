import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { getAppUrl } from "@/lib/appUrl";
import Link from "next/link";
import AgentShareButtons from "@/components/AgentShareButtons";
import AgentTokenPersist from "@/components/AgentTokenPersist";
import AgentSessionCheck from "@/components/AgentSessionCheck";

export default async function AgentPortalPage({ params, searchParams }) {
  const { slug } = params;
  const token    = searchParams?.token;

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return <ErrorScreen message="Business not found." />;
  }

  if (!token) {
    return <AgentSessionCheck slug={slug} />;
  }

  // Look up agent by access token
  const agentsSnap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("agents")
    .where("accessToken", "==", token)
    .limit(1)
    .get();

  if (agentsSnap.empty) {
    return <ErrorScreen message="This access link is invalid or has expired. Contact your media provider to resend your portal link." />;
  }

  const agentDoc  = agentsSnap.docs[0];
  const agent     = agentDoc.data();

  // Fetch bookings that have an associated gallery (listing created)
  const bookingsSnap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("bookings")
    .where("clientEmail", "==", agent.email)
    .get();

  const bookings = bookingsSnap.docs
    .filter((d) => !!d.data().galleryId)   // only show bookings where a gallery exists
    .sort((a, b) => {
      const aTime = a.data().createdAt?.toMillis?.() ?? 0;
      const bTime = b.data().createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    }).map((d) => {
      const data = d.data();
      return {
        id:             d.id,
        address:        data.fullAddress || data.address || "Property",
        status:         data.status || "confirmed",
        workflowStatus: data.workflowStatus || null,
        shootDate:      data.shootDate ? data.shootDate.toDate?.()?.toISOString?.() ?? data.shootDate : null,
        galleryId:        data.galleryId   || null,
        propertyWebsite:  data.propertyWebsite || null,
        totalPrice:       data.totalPrice  || 0,
        photographerName: data.photographerName || null,
        createdAt:        data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

  // Fetch gallery data (including cover image) for each booking
  const galleryIds = bookings.filter((b) => b.galleryId).map((b) => b.galleryId);
  const galleries  = {};
  if (galleryIds.length > 0) {
    await Promise.all(
      galleryIds.map(async (gid) => {
        const gDoc = await adminDb.collection("tenants").doc(tenant.id).collection("galleries").doc(gid).get();
        if (gDoc.exists) {
          const g = gDoc.data();
          const photos = (g.media || []).filter((m) => !m.fileType?.startsWith("video/"));
          galleries[gid] = {
            delivered:   g.delivered || false,
            unlocked:    g.unlocked  || false,
            mediaCount:  photos.length,
            videoCount:  (g.media || []).filter((m) =>  m.fileType?.startsWith("video/")).length,
            accessToken: g.accessToken || null,
            coverUrl:    g.coverUrl || photos[0]?.url || null,
          };
        }
      })
    );
  }

  const primary  = tenant.branding?.primaryColor || "#3486cf";
  const accent   = tenant.branding?.accentColor  || "#c9a96e";
  const appUrl   = getAppUrl();

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-gray-900">Welcome, {agent.name?.split(" ")[0] || "there"}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {bookings.length} active listing{bookings.length !== 1 ? "s" : ""} · {agent.email}
          </p>
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
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🏡</p>
          <p className="font-medium text-gray-500">No listings yet</p>
          <p className="text-sm mt-1">Your listings will appear here once the photographer has created them.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookings.map((b) => {
            const gal = b.galleryId ? galleries[b.galleryId] : null;
            const pw  = b.propertyWebsite;

            return (
              <div key={b.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                {/* Cover image */}
                <div className="relative h-36 bg-gray-100 flex-shrink-0">
                  {gal?.coverUrl ? (
                    <img src={gal.coverUrl} alt={b.address} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    {gal?.delivered ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                        ✓ Delivered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">
                        In Progress
                      </span>
                    )}
                  </div>
                </div>
                {/* Card body */}
                <div className="px-4 pt-3 pb-3">
                  <h2 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{b.address}</h2>
                  {b.shootDate ? (
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(b.shootDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-300 mt-1">Date TBD</p>
                  )}
                </div>

                {/* Quick links */}
                {(gal?.accessToken || pw?.published || pw) && (
                  <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                    {gal?.accessToken && (
                      <a href={`/${slug}/gallery/${gal.accessToken}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1">
                        🖼️ Gallery {gal.mediaCount > 0 ? `(${gal.mediaCount})` : ""}
                      </a>
                    )}
                    {pw?.published && (
                      <a href={`/${slug}/property/${b.id}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1">
                        🏡 Property
                      </a>
                    )}
                    {pw && (
                      <a href={`/${slug}/property/${b.id}/brochure`} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1">
                        📋 Brochure
                      </a>
                    )}
                  </div>
                )}

                {/* Social share */}
                {gal?.delivered && gal?.accessToken && (() => {
                  const galleryUrl  = `${appUrl}/${slug}/gallery/${gal.accessToken}`;
                  const photographer = b.photographerName && b.photographerName !== "TBD"
                    ? ` Photos by ${b.photographerName}.` : "";
                  const shareText   = `Just listed! Check out the media for ${b.address}.${photographer} #JustListed`;
                  return <div className="px-4 pb-3"><AgentShareButtons galleryUrl={galleryUrl} shareText={shareText} /></div>;
                })()}

                {/* View button */}
                <div className="px-4 pb-4 mt-auto">
                  <Link
                    href={`/${slug}/agent/${b.id}?token=${token}`}
                    className="block w-full text-center text-sm font-semibold py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ background: primary }}>
                    View Listing →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Persist token to localStorage so returning agents skip the email link */}
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
