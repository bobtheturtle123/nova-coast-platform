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

  // Fetch gallery delivered status in parallel
  const galleryIds = bookings.filter((b) => b.galleryId).map((b) => b.galleryId);
  const galleries  = {};
  await Promise.all(
    galleryIds.map(async (gid) => {
      const gDoc = await adminDb.collection("tenants").doc(tenant.id).collection("galleries").doc(gid).get();
      if (gDoc.exists) {
        const g = gDoc.data();
        galleries[gid] = {
          delivered:   g.delivered   || false,
          accessToken: g.accessToken || null,
          mediaCount:  (g.media || []).filter((m) => !m.fileType?.startsWith("video/")).length,
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
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Address</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Shoot Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Gallery</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.map((b) => {
                const gal = b.galleryId ? galleries[b.galleryId] : null;
                return (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-900 truncate max-w-xs">{b.address}</p>
                      {gal?.delivered && (
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          Media ready
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 hidden sm:table-cell">
                      {formatDate(b.shootDate) || <span className="text-gray-300">TBD</span>}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      {gal?.delivered ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          {gal.mediaCount > 0 ? `${gal.mediaCount} photos` : "Delivered"}
                        </span>
                      ) : gal ? (
                        <span className="text-xs text-gray-400">In progress</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/${slug}/agent/${b.id}?token=${token}`}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors"
                        style={{ background: primary }}>
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
