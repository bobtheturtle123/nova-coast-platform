import LegalLayout, { Section, Sub, Ul, Callout } from "@/components/LegalLayout";

export const metadata = {
  title: "Privacy Policy — KyoriaOS",
  description: "How KyoriaOS collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="Effective May 8, 2026. Last updated May 8, 2026."
    >
      <Callout>
        This Privacy Policy explains how KyoriaOS (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) collects,
        uses, and protects information when you use our platform. We are committed to
        handling your data responsibly and transparently.
      </Callout>

      <div className="mt-8" />

      <Section title="1. Who We Are">
        <p>
          KyoriaOS operates the business management platform available at{" "}
          <strong>app.kyoriaos.com</strong>. We provide booking management, gallery
          delivery, client portal, payment processing, and related tools for real estate
          photography businesses (&quot;Subscribers&quot;) and their clients and agents
          (&quot;End Users&quot;).
        </p>
        <p>
          For questions about this policy, contact us at:{" "}
          <a href="mailto:privacy@kyoriaos.com" className="text-[#3486cf] underline underline-offset-2">privacy@kyoriaos.com</a>
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <Sub title="Account Information">
          <p>When you register for KyoriaOS, we collect:</p>
          <Ul items={[
            "Name and email address",
            "Business name and contact details",
            "Billing address and payment method (processed by Stripe — we do not store card numbers)",
            "Profile preferences and account settings",
          ]} />
        </Sub>
        <Sub title="Booking & Client Data">
          <p>
            As part of operating the Service on your behalf, we store data you enter
            including:
          </p>
          <Ul items={[
            "Client names, email addresses, and phone numbers",
            "Property addresses and booking details",
            "Shoot dates, times, and photographer assignments",
            "Service selections, pricing, and payment status",
            "Notes, revision requests, and communications",
          ]} />
          <p>
            This data belongs to you as the Subscriber. We process it solely to deliver
            the Service.
          </p>
        </Sub>
        <Sub title="Media & Files">
          <p>
            Files you upload to KyoriaOS — including photos, videos, PDFs, floor plans,
            and other media — are stored on Cloudflare R2 infrastructure. We store
            metadata about files (names, sizes, types, upload timestamps) and use this
            to operate gallery and delivery features.
          </p>
        </Sub>
        <Sub title="Usage Data">
          <p>We automatically collect certain technical data when you use the platform:</p>
          <Ul items={[
            "IP address and approximate geographic location",
            "Browser type, version, and operating system",
            "Device type (desktop, mobile, tablet)",
            "Pages visited, features used, and time spent",
            "Referring URLs and navigation paths",
            "Error logs and performance data",
          ]} />
        </Sub>
        <Sub title="Gallery & Portal Activity">
          <p>
            When agents or clients access gallery portals, we collect activity logs
            including:
          </p>
          <Ul items={[
            "Gallery view timestamps",
            "File download events",
            "IP address of the accessing device",
            "Browser and device metadata",
            "Revision requests submitted",
          ]} />
          <p>
            This data is visible to the Subscriber (photographer) who owns the gallery
            and is used to provide analytics on gallery engagement.
          </p>
        </Sub>
        <Sub title="Communication Data">
          <p>
            When you or your clients interact with automated communications, we log
            whether emails were sent, including metadata like recipient address, subject
            line, and delivery status. We do not read the content of client emails or
            messages beyond what is necessary to operate the platform.
          </p>
        </Sub>
        <Sub title="Cookies & Tracking">
          <p>
            We use cookies and similar technologies to maintain sessions, remember
            preferences, and analyze platform usage. See our{" "}
            <a href="/cookies" className="text-[#3486cf] underline underline-offset-2">Cookie Policy</a> for details.
          </p>
        </Sub>
      </Section>

      <Section title="3. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <Ul items={[
          "Create and maintain your account and provide the Service",
          "Process billing and manage subscriptions via Stripe",
          "Send booking confirmations, gallery delivery links, and invoices to your clients",
          "Send photographer assignment and scheduling notifications",
          "Provide analytics and reporting features within your dashboard",
          "Improve and develop new features of the platform",
          "Respond to support requests and troubleshoot issues",
          "Detect and prevent fraud, abuse, and security incidents",
          "Comply with legal obligations",
          "Send product updates, feature announcements, and billing notices to your account email (you may opt out of marketing emails at any time)",
        ]} />
        <p>
          We do not sell your personal data or your clients&apos; data to third parties.
          We do not use your client data for advertising purposes.
        </p>
      </Section>

      <Section title="4. How We Share Your Information">
        <Sub title="Service Providers">
          <p>
            We share data with trusted third-party providers who help us operate the
            platform. These providers are contractually obligated to protect your data
            and may only use it as directed by us:
          </p>
          <Ul items={[
            "Stripe — payment processing and billing",
            "Resend — transactional email delivery",
            "Cloudflare R2 — file storage and delivery",
            "Google (Firebase, Maps, Calendar) — authentication, mapping, and calendar sync",
            "Anthropic — AI chatbot features (no personal data retained by Anthropic beyond the API call)",
            "Vercel — platform hosting and infrastructure",
          ]} />
        </Sub>
        <Sub title="Your Clients & Agents">
          <p>
            Client names, email addresses, property addresses, and gallery access links
            are shared with the agents and clients you designate within the platform.
            You control who receives this information.
          </p>
        </Sub>
        <Sub title="Legal Requirements">
          <p>
            We may disclose information if required by law, court order, or government
            authority, or if we believe disclosure is necessary to protect the rights,
            property, or safety of KyoriaOS, our users, or the public.
          </p>
        </Sub>
        <Sub title="Business Transfers">
          <p>
            In the event of a merger, acquisition, or sale of assets, your information
            may be transferred to the acquiring entity. We will notify you via email
            before your data becomes subject to a materially different privacy policy.
          </p>
        </Sub>
      </Section>

      <Section title="5. Data Retention">
        <p>We retain data for as long as necessary to provide the Service and comply with legal obligations:</p>
        <Ul items={[
          "Active account data is retained for the duration of your subscription",
          "After account cancellation, data is retained for 30 days to allow for data export",
          "After 30 days post-cancellation, account data including bookings, galleries, and client records may be permanently deleted",
          "Billing records are retained for up to 7 years for tax and legal compliance",
          "Activity logs and analytics data are retained for up to 12 months",
          "Uploaded media files are subject to the retention terms in our Terms of Service",
        ]} />
        <p>
          You may request deletion of your data at any time by contacting{" "}
          <a href="mailto:privacy@kyoriaos.com" className="text-[#3486cf] underline underline-offset-2">privacy@kyoriaos.com</a>.
          Note that some data may be retained for legal compliance even after a deletion request.
        </p>
      </Section>

      <Section title="6. Security">
        <p>
          We implement commercially reasonable technical and organizational measures to
          protect your data, including:
        </p>
        <Ul items={[
          "Encrypted data transmission via TLS/HTTPS on all connections",
          "Firebase Authentication for secure session management and token verification",
          "Tenant-isolated data architecture — each business account&apos;s data is stored in a separate Firestore collection scoped to their tenant ID",
          "Signed URLs for file downloads that expire after a limited period",
          "Role-based access controls within team accounts",
          "Regular security reviews and dependency updates",
        ]} />
        <p>
          Despite these measures, no internet transmission or storage system is 100%
          secure. We cannot guarantee absolute security of your data. You are responsible
          for maintaining secure access credentials.
        </p>
      </Section>

      <Section title="7. Cookies & Analytics">
        <p>
          KyoriaOS uses cookies to maintain authenticated sessions and analyze platform
          usage. We use analytics to understand how the platform is used and improve the
          user experience. We do not use advertising cookies or sell browsing data to
          ad networks.
        </p>
        <p>
          See our full <a href="/cookies" className="text-[#3486cf] underline underline-offset-2">Cookie Policy</a> for
          a complete list of cookies used and instructions for managing your cookie preferences.
        </p>
      </Section>

      <Section title="8. Your Privacy Rights">
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <Ul items={[
          "Access the personal data we hold about you",
          "Correct inaccurate or incomplete information",
          "Request deletion of your personal data (subject to legal retention requirements)",
          "Export your data in a portable format",
          "Object to or restrict certain types of processing",
          "Withdraw consent where processing is based on consent",
        ]} />
        <p>
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:privacy@kyoriaos.com" className="text-[#3486cf] underline underline-offset-2">privacy@kyoriaos.com</a>.
          We will respond within 30 days.
        </p>
        <p>
          For California residents: under the CCPA, you have additional rights including
          the right to know what personal information is collected and shared, and the
          right to opt out of the sale of personal information. We do not sell personal
          information.
        </p>
      </Section>

      <Section title="9. Client Data & Photographer Responsibilities">
        <p>
          KyoriaOS Subscribers (photography businesses) use our platform to store and
          process data about their own clients (agents, homeowners, etc.). In this
          context:
        </p>
        <Ul items={[
          "The Subscriber is the data controller for their clients&apos; personal information",
          "KyoriaOS acts as a data processor, processing client data only as instructed by the Subscriber",
          "Subscribers are responsible for having a lawful basis to collect and store their clients&apos; data",
          "Subscribers are responsible for notifying their clients about how their data is used",
          "Subscribers must comply with applicable privacy laws (CCPA, GDPR, etc.) in their jurisdictions",
        ]} />
      </Section>

      <Section title="10. Children's Privacy">
        <p>
          KyoriaOS is not directed at children under the age of 13, and we do not
          knowingly collect personal information from children. If you believe we have
          inadvertently collected information from a child under 13, please contact us
          at{" "}
          <a href="mailto:privacy@kyoriaos.com" className="text-[#3486cf] underline underline-offset-2">privacy@kyoriaos.com</a>.
        </p>
      </Section>

      <Section title="11. International Data Transfers">
        <p>
          KyoriaOS is operated from the United States. If you access the Service from
          outside the U.S., your data may be transferred to, stored, and processed in
          the United States or other countries where our service providers operate.
          By using the Service, you consent to such transfers.
        </p>
      </Section>

      <Section title="12. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we make material
          changes, we will notify you by email at your registered address at least 14
          days before the changes take effect. The updated policy will be posted at{" "}
          <strong>app.kyoriaos.com/privacy</strong> with a revised effective date.
        </p>
        <p>
          Continued use of the Service after the effective date constitutes acceptance
          of the updated policy.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          For privacy-related questions, data requests, or concerns, contact us at:
        </p>
        <p>
          <a href="mailto:privacy@kyoriaos.com" className="text-[#3486cf] underline underline-offset-2">privacy@kyoriaos.com</a>
        </p>
        <p className="text-gray-400 text-xs mt-2">KyoriaOS · app.kyoriaos.com</p>
      </Section>
    </LegalLayout>
  );
}
