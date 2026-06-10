export const metadata = {
  title: "Acceptable Use Policy — KyoriaOS",
  description: "Rules for acceptable use of the KyoriaOS platform, including prohibited content and conduct.",
};

export default function AcceptableUsePage() {
  const updated = "June 10, 2026";

  return (
    <article className="prose prose-sm prose-gray max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Acceptable Use Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: {updated}</p>

      <Section title="1. Purpose">
        <p>This Acceptable Use Policy ("AUP") governs your use of the KyoriaOS platform and supplements the <a href="/legal/terms">Terms of Service</a>. By using KyoriaOS, you agree to this AUP and are responsible for the activity of anyone you allow to use your account.</p>
      </Section>

      <Section title="2. Prohibited content">
        <p>You may not upload, store, deliver, or transmit content that:</p>
        <ul>
          <li>Is unlawful, defamatory, harassing, abusive, or threatening;</li>
          <li>Infringes intellectual property, privacy, or publicity rights of others;</li>
          <li>Contains malware, or is designed to disrupt or gain unauthorized access to systems;</li>
          <li>Is sexually explicit involving minors, or otherwise illegal;</li>
          <li>You do not have the rights or necessary consents to process or share.</li>
        </ul>
      </Section>

      <Section title="3. Prohibited conduct">
        <p>You may not:</p>
        <ul>
          <li>Attempt to access another tenant's data or any non-public area of the platform;</li>
          <li>Probe, scan, or test the vulnerability of the platform without our written permission;</li>
          <li>Interfere with or place undue load on the platform (e.g., automated scraping, denial-of-service);</li>
          <li>Reverse engineer, resell, or sublicense the platform except as permitted by the Terms;</li>
          <li>Use the platform to send unsolicited messages (spam) or to violate anti-spam, telemarketing (including TCPA), or privacy laws.</li>
        </ul>
      </Section>

      <Section title="4. Messaging and consent">
        <p>If you send email or SMS to your clients through the platform, you are responsible for having a lawful basis and any required consent. See our <a href="/legal/sms-consent">SMS Consent</a> policy. We may suspend messaging features for accounts that generate excessive complaints or appear to violate these rules.</p>
      </Section>

      <Section title="5. Enforcement">
        <p>We may investigate suspected violations and may remove content, suspend, or terminate accounts that violate this AUP, with or without notice depending on severity. We may also report illegal activity to law enforcement.</p>
      </Section>

      <Section title="6. Reporting abuse">
        <p>To report a violation or abuse, contact <a href="mailto:abuse@kyoriaos.com">abuse@kyoriaos.com</a>.</p>
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
