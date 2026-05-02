import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import Link from "next/link";
import AgentShareButtons from "@/components/AgentShareButtons";
import AgentTokenPersist from "@/components/AgentTokenPersist";
import AgentSessionCheck from "@/components/AgentSessionCheck";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import { resolveWorkflowStatus } from "@/lib/workflowStatus";

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
    return <ErrorScreen message="This access link is invalid or has expired. Ask the photographer to resend your portal link." />;
  }

  const agentDoc  = agentsSnap.docs[0];
  const agent     = agentDoc.data();

  // Fetch all their bookings
  const bookingsSnap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("bookings")
    .where("clientEmail", "==", agent.email)
    .get();

  const bookings = bookingsSnap.docs.sort((a, b) => {
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

  // Fetch gallery data for each booking that has one
  const galleryIds = bookings.filter((b) => b.galleryId).map((b) => b.galleryId);
  const galleries  = {};
  if (galleryIds.length > 0) {
    await Promise.all(
      galleryIds.map(async (gid) => {
        const gDoc = await adminDb.collection("tenants").doc(tenant.id).collection("galleries").doc(gid).get();
        if (gDoc.exists) {
          const g = gDoc.data();
          galleries[gid] = {
            delivered:   g.delivered || false,
            unlocked:    g.unlocked  || false,
            mediaCount:  (g.media || []).filter((m) => !m.fileType?.startsWith("video/")).length,
            videoCount:  (g.media || []).filter((m) =>  m.fileType?.startsWith("video/")).length,
            accessToken: g.accessToken || null,
          };
        }
      })
    );
  }

  const primary  = tenant.branding?.primaryColor || "#3486cf";
  const accent   = tenant.branding?.accentColor  || "#c9a96e";
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL || "";

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-gray-900">Welcome, {agent.name?.split(" ")[0] || "there"}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {bookings.length} listing{bookings.length !== 1 ? "s" : ""} · {agent.email}
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🏡</p>
          <p className="font-medium text-gray-500">No listings yet</p>
          <p className="text-sm mt-1">Your listings will appear here once the photographer has created them.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const gal        = b.galleryId ? galleries[b.galleryId] : null;
            const pw         = b.propertyWebsite;
            const wfStatus   = resolveWorkflowStatus(b);

            return (
              <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <WorkflowStatusBadge status={wfStatus} size="xs" />
                      {gal?.delivered && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          ✓ Media Delivered
                        </span>
                      )}
                    </div>
                    <h2 className="font-semibold text-gray-900 text-base truncate">{b.address}</h2>
                    {b.shootDate && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Shoot: {new Date(b.shootDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/${slug}/agent/${b.id}?token=${token}`}
                    className="flex-shrink-0 text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors"
                    style={{ background: primary }}>
                    View →
                  </Link>
                </div>

                {/* Quick links */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
                  {gal?.accessToken && (
                    <a href={`/${slug}/gallery/${gal.accessToken}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                      🖼️ Gallery {gal.mediaCount > 0 ? `(${gal.mediaCount})` : ""}
                    </a>
                  )}
                  {pw?.published && (
                    <a href={`/${slug}/property/${b.id}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                      🏡 Property Site
                    </a>
                  )}
                  {pw && (
                    <a href={`/${slug}/property/${b.id}/brochure`} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                      📋 Brochure
                    </a>
                  )}
                </div>

                {/* Social share — only when gallery is delivered */}
                {gal?.delivered && gal?.accessToken && (() => {
                  const galleryUrl  = `${appUrl}/${slug}/gallery/${gal.accessToken}`;
                  const photographer = b.photographerName && b.photographerName !== "TBD"
                    ? ` Photos by ${b.photographerName}.` : "";
                  const shareText   = `Just listed! Check out the media for ${b.address}.${photographer} #JustListed`;
                  return <AgentShareButtons galleryUrl={galleryUrl} shareText={shareText} />;
                })()}
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
