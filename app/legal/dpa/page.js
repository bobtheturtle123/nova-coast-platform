export const metadata = {
  title: "Data Processing Addendum — KyoriaOS",
  description: "How KyoriaOS processes personal data on behalf of its customers, including sub-processors, security, and data subject rights.",
};

export default function DPAPage() {
  const updated = "June 10, 2026";

  return (
    <article className="prose prose-sm prose-gray max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Data Processing Addendum</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: {updated}</p>

      <Section title="1. Roles of the parties">
        <p>This Data Processing Addendum ("DPA") forms part of the <strong>Terms of Service</strong> between <strong>Rick Ryan Photography LLC</strong> ("KyoriaOS", "we", "us") and the customer ("Customer", "you"). For personal data that you and your clients submit to the platform, <strong>you are the data controller</strong> and <strong>KyoriaOS is the data processor</strong>. KyoriaOS processes such data only on your documented instructions, including as set out in this DPA and the Terms.</p>
      </Section>

      <Section title="2. Scope and nature of processing">
        <p>We process personal data to provide the KyoriaOS platform: booking management, scheduling, media delivery, client and agent communication, and payment facilitation. Categories of data subjects include your clients, real estate agents, and team members. Categories of personal data include names, email addresses, phone numbers, property addresses, booking and payment metadata, and media files you upload.</p>
        <p>We do not sell personal data and do not use your or your clients' personal data for our own marketing.</p>
      </Section>

      <Section title="3. Sub-processors">
        <p>You authorize KyoriaOS to engage the following sub-processors to deliver the service. Each is bound by data-protection obligations no less protective than this DPA:</p>
        <ul>
          <li><strong>Google Firebase / Google Cloud</strong> — authentication and database hosting</li>
          <li><strong>Cloudflare R2</strong> — media file storage</li>
          <li><strong>Vercel</strong> — application hosting</li>
          <li><strong>Stripe</strong> — payment processing</li>
          <li><strong>Resend</strong> — transactional email delivery</li>
          <li><strong>Twilio</strong> — SMS delivery (where enabled)</li>
        </ul>
        <p>We will give notice of any new sub-processor and a reasonable opportunity to object on legitimate data-protection grounds.</p>
      </Section>

      <Section title="4. Security">
        <p>We maintain technical and organizational measures appropriate to the risk, including: encryption in transit (HTTPS), encryption of third-party credentials and OAuth tokens at rest, role-based access controls, tenant data isolation, signed/expiring URLs for media downloads, and least-privilege server-side access to provider APIs. Access to production data is restricted to authorized personnel.</p>
      </Section>

      <Section title="5. Data subject requests">
        <p>Taking into account the nature of the processing, we will assist you with reasonable measures to respond to requests from data subjects to exercise their rights (access, correction, deletion, restriction, portability). Most such data is directly manageable by you within the platform; we will assist with anything that is not.</p>
      </Section>

      <Section title="6. International transfers">
        <p>Personal data may be processed in the United States and other countries where our sub-processors operate. Where required, transfers are made under appropriate safeguards (such as Standard Contractual Clauses) implemented by the relevant sub-processor.</p>
      </Section>

      <Section title="7. Retention and deletion">
        <p>We retain personal data for as long as needed to provide the service and as described in our <a href="/legal/media-policy">Media Storage &amp; Retention Policy</a> and <a href="/legal/privacy">Privacy Policy</a>. On termination, you may export your data within a reasonable period, after which we will delete or anonymize it, except where retention is required by law.</p>
      </Section>

      <Section title="8. Breach notification">
        <p>We will notify you without undue delay after becoming aware of a personal data breach affecting your data, and provide information reasonably available to help you meet your own notification obligations.</p>
      </Section>

      <Section title="9. Liability">
        <p>Each party's liability under this DPA is subject to the limitations and exclusions of liability set out in the Terms of Service.</p>
      </Section>

      <Section title="10. Contact">
        <p>Data-protection questions: <a href="mailto:privacy@kyoriaos.com">privacy@kyoriaos.com</a></p>
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
