export const metadata = {
  title: "Privacy Policy — KyoriaOS",
  description: "How KyoriaOS collects, uses, and protects your information.",
};

export default function PrivacyPolicyPage() {
  const updated = "May 7, 2026";

  return (
    <article className="prose prose-sm prose-gray max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: {updated}</p>

      <Section title="1. Who We Are">
        <p>KyoriaOS ("we", "us", or "our") is a business management platform for real estate photographers and their clients. We operate at <strong>app.kyoriaos.com</strong>. This Privacy Policy explains how we collect, use, disclose, and protect information when you use our platform.</p>
      </Section>

      <Section title="2. Information We Collect">
        <h4>From Photographers (account holders)</h4>
        <ul>
          <li>Name, email address, and password used to create your account</li>
          <li>Business name, logo, and branding preferences</li>
          <li>Billing and subscription information (processed by Stripe — we do not store card numbers)</li>
          <li>Uploaded photos, videos, and media files associated with bookings</li>
          <li>Communication preferences and notification settings</li>
        </ul>
        <h4>From Agents / Clients (portal users)</h4>
        <ul>
          <li>Name and email address (provided by the photographer when creating a booking)</li>
          <li>Phone number (optional, self-provided in the agent portal)</li>
          <li>Property addresses associated with bookings</li>
          <li>Revision requests and messages submitted through the portal</li>
        </ul>
        <h4>Automatically collected</h4>
        <ul>
          <li>Session information (authentication cookies to keep you logged in)</li>
          <li>IP address and browser type (for security and fraud prevention)</li>
          <li>Usage data such as pages visited and features used (aggregate only)</li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Information">
        <ul>
          <li><strong>Providing the service</strong> — delivering the booking management, gallery delivery, and agent portal features you signed up for</li>
          <li><strong>Communications</strong> — sending booking confirmations, portal invites, and notification emails that you have configured</li>
          <li><strong>Billing</strong> — processing subscription payments through our payment processor (Stripe)</li>
          <li><strong>Support</strong> — responding to support requests and diagnosing technical issues</li>
          <li><strong>Security</strong> — detecting and preventing fraud, abuse, and unauthorized access</li>
          <li><strong>Improvements</strong> — understanding how the platform is used to improve features (using aggregate, non-personal data)</li>
        </ul>
        <p>We do not sell your personal information. We do not use your data for advertising purposes.</p>
      </Section>

      <Section title="4. Data Sharing">
        <p>We share information only as necessary to operate our service:</p>
        <ul>
          <li><strong>Firebase / Google</strong> — authentication and database hosting (Google Firebase)</li>
          <li><strong>Stripe</strong> — payment processing for subscriptions</li>
          <li><strong>Resend</strong> — transactional email delivery</li>
          <li><strong>Vercel</strong> — application hosting and infrastructure</li>
          <li><strong>Google Maps</strong> — address autocomplete and travel time calculations</li>
        </ul>
        <p>Each of these sub-processors operates under their own privacy policies and data processing agreements. We do not share your data with advertisers or data brokers.</p>
        <p>Within the platform: photographers can see booking and client data for their own tenants. Agents/clients can only see data related to their own bookings.</p>
      </Section>

      <Section title="5. Data Retention">
        <p>We retain your account data for as long as your account is active. Booking records, media, and associated data are retained indefinitely to support multi-year property records unless you request deletion.</p>
        <p>Deactivated agent accounts have their login credentials removed, but associated booking data is retained for the photographer&apos;s records.</p>
        <p>To request deletion of your data, contact us at <a href="mailto:privacy@kyoriaos.com">privacy@kyoriaos.com</a>.</p>
      </Section>

      <Section title="6. Cookies and Tracking">
        <p>We use cookies and local storage to keep you authenticated and to save preferences. For details, see our <a href="/legal/cookies">Cookie Policy</a>.</p>
        <p>We do not use third-party advertising cookies or tracking pixels.</p>
      </Section>

      <Section title="7. Security">
        <p>We use industry-standard security practices including encrypted connections (HTTPS), Firebase Authentication for account security, and HttpOnly session cookies for agent portal sessions. Payment data is handled exclusively by Stripe and never stored on our servers.</p>
        <p>No system is perfectly secure. We cannot guarantee absolute security, but we take reasonable precautions to protect your information.</p>
      </Section>

      <Section title="8. Your Rights">
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data ("right to be forgotten")</li>
          <li>Object to or restrict certain processing</li>
          <li>Data portability (receive your data in a machine-readable format)</li>
        </ul>
        <p>To exercise these rights, email <a href="mailto:privacy@kyoriaos.com">privacy@kyoriaos.com</a>. We will respond within 30 days.</p>
      </Section>

      <Section title="9. Children's Privacy">
        <p>KyoriaOS is not intended for use by anyone under 18 years of age. We do not knowingly collect personal information from children.</p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>We may update this Privacy Policy from time to time. We will notify account holders of material changes by email or by displaying a notice in the platform. Your continued use of the service after changes constitutes acceptance of the updated policy.</p>
      </Section>

      <Section title="11. Contact">
        <p>Questions about this Privacy Policy? Contact us at:</p>
        <p>
          <strong>KyoriaOS</strong><br />
          Email: <a href="mailto:privacy@kyoriaos.com">privacy@kyoriaos.com</a>
        </p>
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
