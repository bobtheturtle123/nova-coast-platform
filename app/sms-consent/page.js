export const metadata = {
  title: "SMS Consent — KyoriaOS",
  description: "How KyoriaOS handles SMS opt-in and transactional notifications.",
};

export default function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="/" className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">KyoriaOS</a>
          <a href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy Policy</a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">SMS Consent</h1>
        <p className="text-sm text-gray-400 mb-8">Transactional SMS notifications policy</p>

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-8 text-sm text-blue-800 leading-relaxed">
          KyoriaOS is a software platform operated by <strong>Rick Ryan Photography LLC</strong>. The platform enables real estate media businesses to send transactional SMS notifications to their clients.
        </div>

        <Section title="How You Opt In">
          <p>Users opt in to receive SMS messages by providing their phone number through booking forms or account creation within the platform and explicitly agreeing to receive notifications. No phone number is enrolled in SMS communications without a clear opt-in action from the user.</p>
        </Section>

        <Section title="Types of Messages">
          <p>These messages may include:</p>
          <ul>
            <li>Booking confirmations</li>
            <li>Appointment reminders</li>
            <li>Gallery delivery notifications</li>
            <li>Service-related updates</li>
          </ul>
          <p>We do <strong>not</strong> send promotional or marketing SMS messages. All messages are transactional in nature.</p>
        </Section>

        <Section title="Message Frequency & Rates">
          <p><strong>Message frequency varies</strong> based on your booking and account activity. <strong>Message and data rates may apply</strong> depending on your mobile carrier plan.</p>
        </Section>

        <Section title="How to Opt Out">
          <p>Reply <strong>STOP</strong> to any message at any time to unsubscribe. You will receive a confirmation that you have been removed. Reply <strong>START</strong> to re-subscribe.</p>
          <p>You can also manage notification preferences within your account settings at any time.</p>
        </Section>

        <Section title="Getting Help">
          <p>Reply <strong>HELP</strong> to any SMS message, or email us at <a href="mailto:contact@kyoriaos.com" className="text-blue-600 hover:underline">contact@kyoriaos.com</a>.</p>
        </Section>

        <Section title="Data Privacy">
          <p>Phone numbers are used solely for transactional notifications. We do <strong>not</strong> sell or share phone numbers with third parties for marketing. SMS opt-in data is never shared with third parties.</p>
        </Section>

        <Section title="Provider">
          <p>SMS messages are delivered through <strong>Twilio</strong>. See our <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a> for full data handling details.</p>
        </Section>

        <div className="mt-10 pt-6 border-t border-gray-100 text-xs text-gray-400 flex gap-4">
          <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
          <a href="mailto:contact@kyoriaos.com" className="hover:text-gray-600 transition-colors">contact@kyoriaos.com</a>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-7">
      <h2 className="text-sm font-semibold text-gray-800 mb-2">{title}</h2>
      <div className="text-sm text-gray-600 space-y-2 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
