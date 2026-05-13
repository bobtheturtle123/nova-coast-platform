export const metadata = {
  title: "SMS Consent — KyoriaOS",
  description: "How KyoriaOS handles SMS consent and opt-in for transactional notifications.",
};

export default function SmsConsentPage() {
  return (
    <article className="prose prose-sm prose-gray max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">SMS Consent</h1>
      <p className="text-sm text-gray-400 mb-8">How we handle SMS opt-in and notifications</p>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-8 not-prose">
        <p className="text-sm text-blue-800 leading-relaxed">
          KyoriaOS is a software platform operated by <strong>Rick Ryan Photography LLC</strong>. The platform enables real estate media businesses to send transactional SMS notifications to their clients.
        </p>
      </div>

      <Section title="How You Opt In">
        <p>Users opt in to receive SMS messages by providing their phone number through booking forms or account creation within the platform and explicitly agreeing to receive notifications.</p>
        <p>Consent is collected at the point of phone number entry. No phone number is enrolled in SMS communications without a clear opt-in action from the user.</p>
      </Section>

      <Section title="Types of Messages">
        <p>These messages may include:</p>
        <ul>
          <li>Booking confirmations</li>
          <li>Appointment reminders</li>
          <li>Gallery delivery notifications</li>
          <li>Service-related updates</li>
        </ul>
        <p>We do <strong>not</strong> send promotional, marketing, or advertising SMS messages. All messages are transactional in nature and directly related to services you have requested.</p>
      </Section>

      <Section title="Message Frequency & Rates">
        <p><strong>Message frequency varies</strong> based on your booking and account activity.</p>
        <p><strong>Message and data rates may apply</strong> depending on your mobile carrier plan. KyoriaOS does not charge for SMS messages, but your carrier may.</p>
      </Section>

      <Section title="How to Opt Out">
        <p>You can unsubscribe from SMS messages at any time by replying <strong>STOP</strong> to any message you receive. You will receive a confirmation that you have been unsubscribed.</p>
        <p>You can also manage your notification preferences within your account settings at any time.</p>
        <p>To re-subscribe after opting out, reply <strong>START</strong> or update your preferences in your account settings.</p>
      </Section>

      <Section title="Getting Help">
        <p>Reply <strong>HELP</strong> to any SMS message for assistance, or contact us directly at <a href="mailto:contact@kyoriaos.com">contact@kyoriaos.com</a>.</p>
      </Section>

      <Section title="Data Privacy">
        <p>Phone numbers collected for SMS communications are used solely for transactional notifications. We do <strong>not</strong> sell, rent, or share phone numbers with third parties for marketing purposes. SMS opt-in data and consent records are never shared with third parties.</p>
        <p>For full details on how we handle your personal data, see our <a href="/legal/privacy">Privacy Policy</a>.</p>
      </Section>

      <Section title="Provider">
        <p>SMS messages are delivered through <strong>Twilio</strong>, a third-party messaging service provider. Twilio operates under its own privacy policy and terms of service.</p>
      </Section>

      <div className="mt-10 pt-6 border-t border-gray-100 not-prose">
        <p className="text-xs text-gray-400">
          Questions? Contact us at{" "}
          <a href="mailto:contact@kyoriaos.com" className="text-[#3486cf] hover:underline">
            contact@kyoriaos.com
          </a>{" "}
          · <a href="/legal/privacy" className="text-[#3486cf] hover:underline">Privacy Policy</a>
        </p>
      </div>
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
