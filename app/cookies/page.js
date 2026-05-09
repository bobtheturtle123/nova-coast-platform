import LegalLayout, { Section, Sub, Ul, Callout } from "@/components/LegalLayout";

export const metadata = {
  title: "Cookie Policy — KyoriaOS",
  description: "How KyoriaOS uses cookies and similar tracking technologies.",
};

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      subtitle="Effective May 8, 2026. Last updated May 8, 2026."
    >
      <Callout>
        This Cookie Policy explains how KyoriaOS uses cookies and similar technologies
        on our platform. It should be read alongside our{" "}
        <a href="/privacy" className="text-[#3486cf] underline underline-offset-2">Privacy Policy</a>.
      </Callout>

      <div className="mt-8" />

      <Section title="1. What Are Cookies?">
        <p>
          Cookies are small text files placed on your device by websites you visit.
          They are widely used to make websites work efficiently, remember your
          preferences, and provide information to site owners about how the site is used.
        </p>
        <p>
          In addition to cookies, we may also use similar technologies such as local
          storage, session storage, and browser fingerprinting for authentication and
          security purposes.
        </p>
      </Section>

      <Section title="2. Cookies We Use">
        <Sub title="Strictly Necessary Cookies">
          <p>
            These cookies are essential for the platform to function. Without them, you
            cannot log in, navigate the dashboard, or access secure features. They cannot
            be disabled without breaking the Service.
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 border border-gray-200 font-semibold text-gray-600">Cookie</th>
                  <th className="text-left p-2 border border-gray-200 font-semibold text-gray-600">Purpose</th>
                  <th className="text-left p-2 border border-gray-200 font-semibold text-gray-600">Duration</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr>
                  <td className="p-2 border border-gray-200 font-mono">__session</td>
                  <td className="p-2 border border-gray-200">Firebase Authentication session token — keeps you logged in</td>
                  <td className="p-2 border border-gray-200">Session / 1 hour</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-2 border border-gray-200 font-mono">firebase:authUser</td>
                  <td className="p-2 border border-gray-200">Stores Firebase user identity in local storage for fast re-authentication</td>
                  <td className="p-2 border border-gray-200">Persistent (local storage)</td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-200 font-mono">NEXT_LOCALE</td>
                  <td className="p-2 border border-gray-200">Stores your language/locale preference</td>
                  <td className="p-2 border border-gray-200">1 year</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Sub>

        <Sub title="Functional Cookies">
          <p>
            These cookies remember your preferences to improve your experience. Disabling
            them may cause some features to behave unexpectedly.
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 border border-gray-200 font-semibold text-gray-600">Cookie / Storage Key</th>
                  <th className="text-left p-2 border border-gray-200 font-semibold text-gray-600">Purpose</th>
                  <th className="text-left p-2 border border-gray-200 font-semibold text-gray-600">Duration</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr>
                  <td className="p-2 border border-gray-200 font-mono">kyoria_tab</td>
                  <td className="p-2 border border-gray-200">Remembers active dashboard tab selection</td>
                  <td className="p-2 border border-gray-200">Session</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-2 border border-gray-200 font-mono">kyoria_dark</td>
                  <td className="p-2 border border-gray-200">Stores dark mode preference</td>
                  <td className="p-2 border border-gray-200">1 year</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Sub>

        <Sub title="Analytics Cookies">
          <p>
            We use analytics to understand how the platform is used, which features are
            most valuable, and where users encounter difficulty. This helps us improve
            the product.
          </p>
          <p>
            We do not use third-party advertising networks or share analytics data with
            ad platforms. Analytics data is aggregated and used only for product
            development.
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 border border-gray-200 font-semibold text-gray-600">Source</th>
                  <th className="text-left p-2 border border-gray-200 font-semibold text-gray-600">Purpose</th>
                  <th className="text-left p-2 border border-gray-200 font-semibold text-gray-600">Data Retained</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr>
                  <td className="p-2 border border-gray-200">Vercel Analytics</td>
                  <td className="p-2 border border-gray-200">Page views, performance metrics, error rates</td>
                  <td className="p-2 border border-gray-200">90 days</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-2 border border-gray-200">Internal event logs</td>
                  <td className="p-2 border border-gray-200">Gallery views, downloads, feature usage within dashboard</td>
                  <td className="p-2 border border-gray-200">12 months</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Sub>

        <Sub title="Third-Party Cookies">
          <p>
            Some features of KyoriaOS embed third-party services that may set their own
            cookies:
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 border border-gray-200 font-semibold text-gray-600">Third Party</th>
                  <th className="text-left p-2 border border-gray-200 font-semibold text-gray-600">Used For</th>
                  <th className="text-left p-2 border border-gray-200 font-semibold text-gray-600">Their Policy</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr>
                  <td className="p-2 border border-gray-200">Google (Firebase)</td>
                  <td className="p-2 border border-gray-200">Authentication and session management</td>
                  <td className="p-2 border border-gray-200">policies.google.com</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-2 border border-gray-200">Google Maps</td>
                  <td className="p-2 border border-gray-200">Address autocomplete and map embeds</td>
                  <td className="p-2 border border-gray-200">policies.google.com</td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-200">Stripe</td>
                  <td className="p-2 border border-gray-200">Payment processing and fraud prevention</td>
                  <td className="p-2 border border-gray-200">stripe.com/privacy</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            These third parties set cookies under their own policies. KyoriaOS does not
            control how these parties use cookies and cannot disable them without
            disabling the associated features.
          </p>
        </Sub>
      </Section>

      <Section title="3. Gallery Portal Tracking">
        <p>
          When real estate agents or clients access a gallery portal link, KyoriaOS
          logs certain activity for the benefit of the Subscriber (photographer):
        </p>
        <Ul items={[
          "First view and most recent view timestamps",
          "Number of times the gallery was opened",
          "Files downloaded (type and count)",
          "IP address and device/browser metadata of the viewer",
          "Geographic region (country/state, derived from IP)",
        ]} />
        <p>
          This data is visible to the photographer who owns the gallery and is used to
          provide engagement analytics. By accessing a gallery portal, agents and clients
          consent to this activity logging as disclosed in the photographer&apos;s booking
          communications.
        </p>
      </Section>

      <Section title="4. How to Manage Cookies">
        <Sub title="Browser Settings">
          <p>
            Most browsers allow you to view, block, or delete cookies through their
            settings. Blocking strictly necessary cookies will prevent you from logging
            in and using the platform. Here are links to cookie management instructions
            for common browsers:
          </p>
          <Ul items={[
            "Chrome: Settings → Privacy and security → Cookies and other site data",
            "Firefox: Settings → Privacy & Security → Cookies and Site Data",
            "Safari: Preferences → Privacy → Manage Website Data",
            "Edge: Settings → Cookies and site permissions",
          ]} />
        </Sub>
        <Sub title="Opt-Out of Analytics">
          <p>
            You can opt out of Vercel Analytics by enabling &quot;Do Not Track&quot; in your
            browser settings. KyoriaOS honors browser DNT signals for analytics
            tracking purposes.
          </p>
        </Sub>
        <Sub title="Note on Functionality">
          <p>
            Disabling cookies beyond analytics may impact your ability to use the
            platform. Authentication sessions, form state, and user preferences depend
            on browser storage. We recommend keeping functional and necessary cookies
            enabled.
          </p>
        </Sub>
      </Section>

      <Section title="5. Updates to This Policy">
        <p>
          We may update this Cookie Policy when we add new features or integrations that
          use cookies. Material changes will be communicated via email to active
          Subscribers. The updated policy will always be available at{" "}
          <strong>app.kyoriaos.com/cookies</strong>.
        </p>
      </Section>

      <Section title="6. Contact">
        <p>
          Questions about our use of cookies can be sent to:{" "}
          <a href="mailto:privacy@kyoriaos.com" className="text-[#3486cf] underline underline-offset-2">privacy@kyoriaos.com</a>
        </p>
        <p className="text-gray-400 text-xs mt-2">KyoriaOS · app.kyoriaos.com</p>
      </Section>
    </LegalLayout>
  );
}
