// Subtle attribution shown on tenant-facing generated pages (booking, property
// sites, agent portal, galleries). Renders a real dofollow link to kyoriaos.com
// for SEO. Hidden when the studio is on their own verified custom domain.
export default function PoweredByKyoria() {
  return (
    <div style={{ textAlign: "center", padding: "22px 16px 26px" }}>
      <a
        href="https://www.kyoriaos.com"
        target="_blank"
        rel="noopener"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "#9CA3AF",
          textDecoration: "none",
          letterSpacing: "0.01em",
        }}
      >
        Powered by <span style={{ fontWeight: 600, color: "#6B7280" }}>KyoriaOS</span>
      </a>
    </div>
  );
}
