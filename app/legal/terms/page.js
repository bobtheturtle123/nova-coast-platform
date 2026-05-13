export const metadata = {
  title: "Terms of Service — KyoriaOS",
  description: "Terms governing use of the KyoriaOS platform.",
};

export default function TermsPage() {
  const updated = "May 12, 2026";

  return (
    <article className="prose prose-sm prose-gray max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: {updated}</p>

      <Section title="1. About KyoriaOS">
        <p>KyoriaOS is a business management software platform operated by <strong>Rick Ryan Photography LLC</strong> ("Company", "we", "us", or "our"). The platform provides booking management, payment processing, media delivery, and client communication tools for real estate photography businesses and their clients.</p>
        <p>By accessing or using KyoriaOS at <strong>app.kyoriaos.com</strong>, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.</p>
      </Section>

      <Section title="2. Accounts and Access">
        <p>To use KyoriaOS, you must create an account and provide accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</p>
        <p>You must be at least 18 years old to use this platform. By using KyoriaOS, you represent that you meet this requirement.</p>
        <p>We reserve the right to suspend or terminate accounts that violate these Terms or are used for fraudulent, harmful, or illegal purposes.</p>
      </Section>

      <Section title="3. User Responsibilities">
        <p>As a user of KyoriaOS, you agree to:</p>
        <ul>
          <li>Use the platform only for lawful purposes and in compliance with all applicable laws and regulations</li>
          <li>Not attempt to gain unauthorized access to any portion of the platform or its related systems</li>
          <li>Not upload, transmit, or distribute content that is illegal, harmful, defamatory, or infringes on the rights of others</li>
          <li>Not reverse engineer, decompile, or attempt to extract the source code of the platform</li>
          <li>Ensure that any client data you enter into the platform is obtained with appropriate consent</li>
          <li>Comply with all applicable privacy laws when handling client phone numbers, email addresses, and personal information</li>
        </ul>
      </Section>

      <Section title="4. SMS Notifications">
        <p>KyoriaOS may send SMS notifications to clients and team members on behalf of photographers using the platform. These are transactional messages related to bookings, appointments, and gallery deliveries.</p>
        <p>By providing a phone number in the platform, recipients consent to receive these notifications. Message frequency varies. Message and data rates may apply. Recipients may reply STOP to unsubscribe at any time.</p>
        <p>Photographers using the platform are responsible for ensuring they have obtained appropriate consent before adding client phone numbers.</p>
      </Section>

      <Section title="5. Payment Terms">
        <p>Subscription fees for KyoriaOS are billed on a recurring basis (monthly or annually, depending on your selected plan). All payments are processed securely through Stripe.</p>
        <p>Subscription fees are non-refundable except as required by applicable law or as expressly stated in a written agreement with us. You may cancel your subscription at any time; cancellation takes effect at the end of your current billing period.</p>
        <p>We reserve the right to change pricing with at least 30 days&apos; notice to active subscribers. Continued use of the platform after a price change constitutes acceptance of the new pricing.</p>
      </Section>

      <Section title="6. Intellectual Property">
        <p>KyoriaOS and its original content, features, and functionality are owned by Rick Ryan Photography LLC and are protected by applicable intellectual property laws.</p>
        <p>You retain ownership of all media, images, and content you upload to the platform. By uploading content, you grant us a limited, non-exclusive license to host and display that content solely for the purpose of providing the service to you.</p>
      </Section>

      <Section title="7. Service Availability">
        <p>We strive to maintain high availability of the KyoriaOS platform but do not guarantee uninterrupted access. The platform may be unavailable due to scheduled maintenance, updates, or circumstances beyond our control.</p>
        <p>We are not liable for any losses or damages resulting from service downtime or interruptions.</p>
      </Section>

      <Section title="8. Limitation of Liability">
        <p>To the fullest extent permitted by applicable law, Rick Ryan Photography LLC and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, or goodwill, arising out of or related to your use of the platform.</p>
        <p>Our total liability to you for any claims arising under these Terms shall not exceed the amount you paid to us in the 12 months preceding the claim.</p>
      </Section>

      <Section title="9. Disclaimers">
        <p>KyoriaOS is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, either express or implied. We do not warrant that the platform will be error-free, secure, or meet your specific requirements.</p>
        <p>We are not responsible for the accuracy of property listings, pricing, or any content entered by users of the platform.</p>
      </Section>

      <Section title="10. Termination">
        <p>You may terminate your account at any time by contacting us or through your account settings. Upon termination, your access to the platform will cease at the end of your billing period.</p>
        <p>We may terminate or suspend your account immediately, without prior notice, if you breach these Terms or if we determine that continued access poses a risk to the platform or other users.</p>
        <p>Upon termination, provisions of these Terms that by their nature should survive will remain in effect, including ownership provisions, warranty disclaimers, and limitations of liability.</p>
      </Section>

      <Section title="11. Governing Law">
        <p>These Terms are governed by and construed in accordance with the laws of the <strong>State of California, United States</strong>, without regard to conflict of law principles. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in California.</p>
      </Section>

      <Section title="12. Changes to These Terms">
        <p>We may update these Terms from time to time. We will notify account holders of material changes by email or by displaying a notice within the platform. Your continued use of the platform after changes constitutes acceptance of the updated Terms.</p>
      </Section>

      <Section title="13. Contact">
        <p>Questions about these Terms? Contact us at:</p>
        <p>
          <strong>KyoriaOS · Rick Ryan Photography LLC</strong><br />
          Email: <a href="mailto:contact@kyoriaos.com">contact@kyoriaos.com</a>
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
