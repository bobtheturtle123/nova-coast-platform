export const metadata = {
  title: "Media Storage & Retention Policy - KyoriaOS",
  description: "How KyoriaOS stores media, the storage limit, and how long full-resolution photo files are retained.",
};

export default function MediaPolicyPage() {
  const updated = "June 9, 2026";

  return (
    <article className="prose prose-sm prose-gray max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Media Storage &amp; Retention Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: {updated}</p>

      <Section title="Storage included">
        <p>Each account includes up to <strong>10&nbsp;TB of storage</strong>. This limit is the same for every plan. If an account approaches the limit, we&apos;ll reach out before it affects your ability to upload new media. Reaching the limit never deletes anything and never breaks existing galleries.</p>
      </Section>

      <Section title="Full-resolution photo &amp; video retention">
        <p><strong>Full-resolution photo and video files are available for download for 1&nbsp;year after delivery.</strong> After that, large original files may be removed for storage management. Optimized gallery images and 1080p web-viewable videos may remain available so galleries can continue to display normally.</p>
        <p>The following remain available with no time limit:</p>
        <ul>
          <li>Gallery previews and thumbnails</li>
          <li>Web-sized / MLS-ready images</li>
          <li>1080p web-viewable videos (when generated)</li>
          <li>Floor plans and documents</li>
          <li>Matterport links, 3D tour links, and property website links</li>
          <li>Property websites and pages</li>
          <li>Order history, invoices, and payment records</li>
          <li>Client and agent portal records, and download history</li>
        </ul>
        <p>Only the large full-resolution original photo and video files are affected by the 1-year window. Whole listings are never automatically deleted, and nothing is archived, hidden, or deactivated.</p>
      </Section>

      <Section title="1080p web video">
        <p>When possible we keep two versions of each video: the full-resolution delivery file (for download, for 1&nbsp;year) and a 1080p web-viewable version used for gallery playback. The 1080p version is kept long-term so older galleries still play normally, and is encoded at a high bitrate so real estate footage stays sharp and professional.</p>
      </Section>

      <Section title="Downloading your media">
        <p>You can download everything in a gallery at any time. Within the 1-year window, &ldquo;Download all&rdquo; includes full-resolution photos and videos, documents, and floor plans. After the window, it includes optimized gallery images, 1080p web videos, documents, and floor plans.</p>
        <p>Large, video-heavy galleries are prepared in the background and delivered as soon as they&apos;re ready: <em>&ldquo;Preparing your download. Large video-heavy galleries may take a few minutes.&rdquo;</em></p>
      </Section>
    </article>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-gray-800 mt-8 mb-3">{title}</h2>
      <div className="text-sm text-gray-600 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}
