export const metadata = {
  title: "Cookie Policy — KyoriaOS",
  description: "How KyoriaOS uses cookies and similar technologies.",
};

export default function CookiePolicyPage() {
  const updated = "May 7, 2026";

  return (
    <article className="prose prose-sm prose-gray max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Cookie Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: {updated}</p>

      <Section title="1. What Are Cookies?">
        <p>Cookies are small text files placed on your device by a website. They allow the site to remember your actions and preferences over time, or to keep you signed in between visits.</p>
        <p>KyoriaOS also uses browser Local Storage in some cases — a similar technology that stores data directly in your browser without expiration.</p>
      </Section>

      <Section title="2. Cookies We Use">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Purpose</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>__session</code></td>
              <td>Essential</td>
              <td>Firebase Authentication session for photographer dashboard accounts</td>
              <td>Session / 2 weeks</td>
            </tr>
            <tr>
              <td><code>agt_[slug]</code></td>
              <td>Essential</td>
              <td>Agent portal session cookie — keeps agents logged in to the client portal</td>
              <td>30 days</td>
            </tr>
            <tr>
              <td><code>__stripe_mid</code>, <code>__stripe_sid</code></td>
              <td>Essential</td>
              <td>Set by Stripe for fraud prevention during payment flows</td>
              <td>1 year / session</td>
            </tr>
          </tbody>
        </table>
        <p>We do <strong>not</strong> use advertising cookies, remarketing cookies, or third-party analytics cookies (e.g., Google Analytics).</p>
      </Section>

      <Section title="3. Local Storage">
        <p>In older versions of the agent portal (pre-May 2026), we used Local Storage to remember access tokens between visits. This has been replaced by secure HttpOnly cookies. Any existing Local Storage entries from the old system are no longer read by the platform.</p>
      </Section>

      <Section title="4. Essential vs. Optional Cookies">
        <p>All cookies used by KyoriaOS are <strong>essential</strong> — they are required for the platform to function. Without them, you cannot stay logged in or access your account.</p>
        <p>We do not use optional analytics, personalization, or advertising cookies. Therefore, a cookie consent banner is not displayed, as no non-essential cookies are set.</p>
      </Section>

      <Section title="5. Managing Cookies">
        <p>You can control cookies through your browser settings:</p>
        <ul>
          <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
          <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
          <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
          <li><strong>Edge:</strong> Settings → Cookies and site permissions</li>
        </ul>
        <p>Note: Blocking essential cookies will prevent you from staying logged in to KyoriaOS.</p>
        <p>To clear your agent portal session, use the <strong>Sign Out</strong> button in your portal settings.</p>
      </Section>

      <Section title="6. Third-Party Cookies">
        <p>When you interact with a Stripe payment form, Stripe may set their own cookies for fraud prevention. These are governed by <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe&apos;s Privacy Policy</a>.</p>
        <p>No other third-party cookies are set by the KyoriaOS platform.</p>
      </Section>

      <Section title="7. Changes to This Policy">
        <p>We may update this Cookie Policy if our use of cookies changes. Material changes will be communicated to account holders. Continued use of the platform constitutes acceptance.</p>
      </Section>

      <Section title="8. Contact">
        <p>Questions about cookies? Email <a href="mailto:privacy@kyoriaos.com">privacy@kyoriaos.com</a>.</p>
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
